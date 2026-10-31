package io.updish.core.business;
import io.updish.core.auth.WalletPrincipal;
import static io.updish.core.business.WorkbenchService.*;
import java.util.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/workbench/settlements")
public class AgentController {
    private final WorkbenchService work;private final AgentGateway gateway;
    public AgentController(WorkbenchService work,AgentGateway gateway){this.work=work;this.gateway=gateway;}
    public record Question(String question) {}
    @PostMapping("/{id}/explain") Object explain(@AuthenticationPrincipal WalletPrincipal a,@PathVariable UUID id,@RequestBody Question b) {
        var question=reason(b.question());var s=work.settlement(a,id);
        var lines=work.rows("SELECT id,units,amount_won,paid_won,prior_paid_won,delta_won FROM settlement_line WHERE settlement_id=? AND address=?",id,a.address());
        if(lines.isEmpty()) throw BusinessFailure.forbidden();if(!s.get("status").equals("APPROVED")) throw BusinessFailure.conflict("승인된 정산의 근거를 설명합니다.");
        var o=work.one("SELECT title,contract_version,rate_bps,months,target_units,unit_price,revenue_scope FROM offering WHERE id=?",uuid(s,"offering_id"));
        var e=work.one("SELECT id,report,source_hash FROM evidence WHERE id=?",uuid(s,"evidence_id"));
        var context=new LinkedHashMap<String,Object>();context.put("contract",o);context.put("reconciliation",e.get("report"));context.put("ownLines",lines);
        var receipts=work.rows("SELECT j.id,j.status,j.tx_hash,i.amount_units,previous.version FROM distribution_intent i JOIN chain_job j ON j.id=i.job_id JOIN settlement previous ON previous.id=i.settlement_id JOIN settlement_line l ON l.id=i.line_id WHERE j.kind='PAY_DISTRIBUTION' AND previous.status='APPROVED' AND previous.offering_id=? AND previous.period=? AND l.address=? ORDER BY j.created_at",uuid(s,"offering_id"),s.get("period"),a.address());
        long received=receipts.stream().filter(r->"SAFE".equals(r.get("status"))).mapToLong(r->number(r,"amount_units")).sum();
        long obligation=number(lines.getFirst(),"amount_won");
        context.put("testAssetReceipts",receipts);
        context.put("distributionSummary",Map.of("obligationWon",Long.toString(obligation),"confirmedDemoReceivedUnits",Long.toString(received),"additionalDemoDueUnits",Long.toString(Math.max(0,obligation-received)),"demoAboveCorrectedObligationUnits",Long.toString(Math.max(0,received-obligation)),"correctionPolicy","하향 정정은 기존 수령 영수증을 지우거나 토큰을 회수하지 않는다. 초과 수령이 있으면 추가 분배하지 않는다."));
        context.put("testAssetPolicy","DEMO 토큰은 가스용 ETH·현금·원화 담보 자산이 아니다. 계산상 원 단위와 대응하는 테스트 수량이며 SAFE 기록만 수령 확인으로 설명한다. 모의 원장의 지급과 테스트 토큰 수령을 합산하지 않는다.");
        context.put("period",s.get("period"));context.put("poolWon",s.get("pool_won"));context.put("cashAvailableWon",s.get("cash_available"));context.put("principal","만기 원금 별도 상환 의무 없음");context.put("tax","세전·세금과 수수료 미설정");context.put("dataVersion",s.get("digest"));context.put("sourceIds",List.of(id.toString(),e.get("id").toString()));context.put("mode","SIMULATION");
        return gateway.explain(a,id,question,context);
    }
    @PostMapping("/{id}/private-distribution") Object bojagi(@AuthenticationPrincipal WalletPrincipal a,@PathVariable UUID id) {
        work.requireOperator(a);work.settlement(a,id);throw new BusinessFailure("BOJAGI_NOT_CONNECTED",503,"Bojagi 공식 SDK·테스트 접근이 확보되지 않아 실제 분배를 제출하지 않았습니다.");
    }
}
