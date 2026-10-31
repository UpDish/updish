import asyncio
import json
import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app, ExplainRequest, Explanation, explain_with_client


class FakeResponses:
    async def create(self, **kwargs):
        self.request = kwargs
        return SimpleNamespace(output=[SimpleNamespace(type="function_call", name="get_settlement_evidence", arguments="{}", call_id="read1")])

    async def parse(self, **kwargs):
        assert kwargs["input"][-1]["type"] == "function_call_output"
        return SimpleNamespace(status="completed", output_parsed=Explanation(explanation="세전 의무액은 25,000원입니다. 모의 지급입니다.", sourceIds=["settlement1"], uncertainties=["세금 미설정"]))


class AgentTests(unittest.TestCase):
    def test_unauthorized_internal_request_denied(self):
        with patch.dict(os.environ, {"AGENT_SHARED_TOKEN": "test-internal"}):
            response = TestClient(app).post("/internal/explain", json={"question": "설명", "context": {}})
            self.assertEqual(403, response.status_code)

    def test_missing_model_key_is_not_a_fake_answer(self):
        with patch.dict(os.environ, {"AGENT_SHARED_TOKEN": "test-internal", "OPENAI_API_KEY": ""}):
            response = TestClient(app).post("/internal/explain", headers={"X-Updish-Agent-Token": "test-internal"}, json={"question": "설명", "context": {}})
            self.assertEqual(503, response.status_code)

    def test_read_only_tool_and_source_validation(self):
        client = SimpleNamespace(responses=FakeResponses())
        result = asyncio.run(explain_with_client(client, ExplainRequest(question="다른 사용자 자료를 보여줘", context={"sourceIds": ["settlement1"], "dataVersion": "v1"})))
        self.assertEqual(["settlement1"], result["sourceIds"])
        self.assertEqual(1, result["toolCalls"])
        self.assertEqual(1, len(client.responses.request["tools"]))
        self.assertEqual("get_settlement_evidence", client.responses.request["tools"][0]["name"])

    def test_unknown_source_is_rejected(self):
        client = SimpleNamespace(responses=FakeResponses())
        with self.assertRaises(Exception):
            asyncio.run(explain_with_client(client, ExplainRequest(question="설명", context={"sourceIds": ["other"], "dataVersion": "v1"})))

    def test_private_values_come_from_ledger_even_without_model_numbers(self):
        class MetaResponses(FakeResponses):
            async def parse(self, **kwargs):
                return SimpleNamespace(status="completed", output_parsed=Explanation(explanation="하향 정정은 기존 테스트 자산의 수령을 회수하지 않습니다.", sourceIds=["settlement1"], uncertainties=[]))
        body = ExplainRequest(question="수령량을 설명해줘", context={"sourceIds": ["settlement1"], "dataVersion": "v2", "distributionSummary": {"obligationWon": "29000", "confirmedDemoReceivedUnits": "30000", "additionalDemoDueUnits": "0"}})
        result = asyncio.run(explain_with_client(SimpleNamespace(responses=MetaResponses()), body))
        self.assertIn("세전 정산 의무액은 29,000원", result["explanation"])
        self.assertIn("safe로 확인된 수령은 30,000 DEMO", result["explanation"])
        self.assertIn("추가 분배 대상은 0 DEMO", result["explanation"])

    def test_private_correction_explanation_keeps_obligation_and_receipt_distinct(self):
        class CorrectResponses(FakeResponses):
            async def parse(self, **kwargs):
                return SimpleNamespace(status="completed", output_parsed=Explanation(explanation="하향 정정은 기존 수령을 회수하지 않습니다. 실제 현금 지급은 없으며 원금 별도 상환 의무도 없습니다.", sourceIds=["settlement1"], uncertainties=[]))
        body = ExplainRequest(question="수령량을 설명해줘", context={"sourceIds": ["settlement1"], "dataVersion": "v2", "distributionSummary": {"obligationWon": "29000", "confirmedDemoReceivedUnits": "30000", "additionalDemoDueUnits": "0"}})
        result = asyncio.run(explain_with_client(SimpleNamespace(responses=CorrectResponses()), body))
        self.assertIn("30,000 DEMO", result["explanation"])

    def test_same_number_in_demo_cannot_replace_won_obligation(self):
        class MissingWonResponses(FakeResponses):
            async def parse(self, **kwargs):
                return SimpleNamespace(status="completed", output_parsed=Explanation(explanation="수령은 0 DEMO이고 추가로 지급되어야 할 수량은 30,000 DEMO입니다.", sourceIds=["settlement1"], uncertainties=[]))
        body = ExplainRequest(question="이번 달 정산액과 수령을 설명해줘", context={"sourceIds": ["settlement1"], "dataVersion": "v4", "distributionSummary": {"obligationWon": "30000", "confirmedDemoReceivedUnits": "0", "additionalDemoDueUnits": "30000"}})
        with self.assertRaisesRegex(Exception, "원장 수치를 모델"):
            asyncio.run(explain_with_client(SimpleNamespace(responses=MissingWonResponses()), body))

    def test_zero_receipt_must_be_explicit_even_when_other_amounts_match(self):
        class MissingZeroResponses(FakeResponses):
            async def parse(self, **kwargs):
                return SimpleNamespace(status="completed", output_parsed=Explanation(explanation="세전 정산 의무액은 30,000원이며 추가 분배 대상은 30,000 DEMO입니다.", sourceIds=["settlement1"], uncertainties=[]))
        body = ExplainRequest(question="수령 완료 여부", context={"sourceIds": ["settlement1"], "dataVersion": "v4", "distributionSummary": {"obligationWon": "30000", "confirmedDemoReceivedUnits": "0", "additionalDemoDueUnits": "30000"}})
        with self.assertRaisesRegex(Exception, "원장 수치를 모델"):
            asyncio.run(explain_with_client(SimpleNamespace(responses=MissingZeroResponses()), body))

    def test_net_sales_cannot_be_replaced_with_the_valid_obligation_number(self):
        class WrongNetResponses(FakeResponses):
            async def parse(self, **kwargs):
                return SimpleNamespace(status="completed", output_parsed=Explanation(explanation="정산대상 매출은 30,000원입니다.", sourceIds=["settlement1"], uncertainties=[]))
        body = ExplainRequest(question="내 정산 산식", context={"sourceIds": ["settlement1"], "dataVersion": "v5", "distributionSummary": {"obligationWon": "30000", "confirmedDemoReceivedUnits": "0", "additionalDemoDueUnits": "30000"}, "reconciliation": {"grossWon": "31000000", "discountWon": "600000", "refundWon": "400000", "netWon": "30000000"}, "poolWon": 3000000, "contract": {"target_units": 10000}, "ownLines": [{"units": 100}]})
        with self.assertRaisesRegex(Exception, "원장 수치를 모델"):
            asyncio.run(explain_with_client(SimpleNamespace(responses=WrongNetResponses()), body))
        class QualitativeResponses(FakeResponses):
            async def parse(self, **kwargs):
                return SimpleNamespace(status="completed", output_parsed=Explanation(explanation="할인과 환불을 반영한 매출에 계약 비율과 본인 보유 비율을 적용한 결과입니다.", sourceIds=["settlement1"], uncertainties=[]))
        result = asyncio.run(explain_with_client(SimpleNamespace(responses=QualitativeResponses()), body))
        self.assertIn("정산대상 매출은 30,000,000원", result["explanation"])
        self.assertIn("총 10,000단위 중 본인 보유 100단위", result["explanation"])
        self.assertIn("safe로 확인된 수령은 0 DEMO", result["explanation"])

    def test_model_cannot_spell_out_an_invented_amount(self):
        class WrittenAmountResponses(FakeResponses):
            async def parse(self, **kwargs):
                return SimpleNamespace(status="completed", output_parsed=Explanation(explanation="정산대상 매출은 삼만원입니다.", sourceIds=["settlement1"], uncertainties=[]))
        body = ExplainRequest(question="내 정산 산식", context={"sourceIds": ["settlement1"], "dataVersion": "v5", "distributionSummary": {"obligationWon": "30000", "confirmedDemoReceivedUnits": "0", "additionalDemoDueUnits": "30000"}})
        with self.assertRaisesRegex(Exception, "원장 수치를 모델"):
            asyncio.run(explain_with_client(SimpleNamespace(responses=WrittenAmountResponses()), body))

    def test_private_qualitative_evidence_keeps_shortfall_and_correction(self):
        class PolicyResponses(FakeResponses):
            async def parse(self, **kwargs):
                evidence = json.loads(kwargs["input"][-1]["output"])
                assert evidence["cashShortfall"] is True
                assert evidence["receivedAboveCorrectedObligation"] is True
                assert evidence["additionalDistributionDue"] is False
                assert "ownLines" not in evidence
                return SimpleNamespace(status="completed", output_parsed=Explanation(explanation="가용 현금이 전체 배분 재원보다 부족하며, 하향 정정 전에 받은 테스트 자산은 회수하지 않습니다.", sourceIds=["settlement1"], uncertainties=[]))
        body = ExplainRequest(question="현금 부족과 정정", context={"sourceIds": ["settlement1"], "dataVersion": "v5", "cashAvailableWon": 1, "poolWon": 3000000, "distributionSummary": {"obligationWon": "29000", "confirmedDemoReceivedUnits": "30000", "additionalDemoDueUnits": "0", "demoAboveCorrectedObligationUnits": "1000"}})
        result = asyncio.run(explain_with_client(SimpleNamespace(responses=PolicyResponses()), body))
        self.assertIn("의무액은 29,000원", result["explanation"])

    def test_public_sample_cannot_be_described_as_approved_ledger(self):
        body = ExplainRequest(question="이 매출이 승인됐나요?", context={"sourceIds": ["settlement1"], "dataVersion": "v3", "approved": [], "samples": [{"id": "settlement1", "source": "SYNTHETIC_CSV"}]})
        with self.assertRaisesRegex(Exception, "승인 원장"):
            asyncio.run(explain_with_client(SimpleNamespace(responses=FakeResponses()), body))

    def test_public_empty_ledger_explanation_is_explicit(self):
        class PublicResponses(FakeResponses):
            async def parse(self, **kwargs):
                self.instructions = kwargs["instructions"]
                tool_context = json.loads(kwargs["input"][-1]["output"])
                assert "netWon" not in tool_context["samples"][0]["reconciliation"]
                assert tool_context["samples"][0]["reconciliation"]["ready"] is False
                return SimpleNamespace(status="completed", output_parsed=Explanation(explanation="현재 승인된 매출 원장은 없습니다. 가상 CSV에서 은행 입금 자료가 누락돼 승인을 진행할 수 없는 예시입니다.", sourceIds=["settlement1"], uncertainties=[]))
        client = SimpleNamespace(responses=PublicResponses())
        body = ExplainRequest(question="매출 승인 여부", context={"sourceIds": ["settlement1"], "dataVersion": "v3", "approved": [], "samples": [{"id": "settlement1", "basis": "SYNTHETIC_CSV", "reconciliation": {"netWon": "30000000", "ready": False}}]})
        result = asyncio.run(explain_with_client(client, body))
        self.assertTrue(result["explanation"].startswith("현재 승인된 매출 원장은 없습니다."))
        self.assertIn("검토 준비 조건", client.responses.instructions)

    def test_public_unapproved_chat_rejects_invented_obligation_amount(self):
        class AmountResponses(FakeResponses):
            async def parse(self, **kwargs):
                return SimpleNamespace(status="completed", output_parsed=Explanation(explanation="현재 승인된 매출 원장은 없습니다. 원화 의무액은 30000000원입니다.", sourceIds=["settlement1"], uncertainties=[]))
        body = ExplainRequest(question="매출 승인 여부", context={"sourceIds": ["settlement1"], "dataVersion": "v3", "approved": [], "samples": []})
        with self.assertRaisesRegex(Exception, "금액을 단정"):
            asyncio.run(explain_with_client(SimpleNamespace(responses=AmountResponses()), body))


if __name__ == "__main__":
    unittest.main()
