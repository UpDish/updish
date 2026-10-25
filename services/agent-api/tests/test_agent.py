import asyncio
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


if __name__ == "__main__":
    unittest.main()
