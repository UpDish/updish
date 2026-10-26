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
        var o=work.one("SELECT title,contract_version,rate_bps,months FROM offering WHERE id=?",uuid(s,"offering_id"));
        var e=work.one("SELECT id,report,source_hash FROM evidence WHERE id=?",uuid(s,"evidence_id"));
        var context=new LinkedHashMap<String,Object>();context.put("contract",o);context.put("reconciliation",e.get("report"));context.put("ownLines",lines);
        context.put("period",s.get("period"));context.put("poolWon",s.get("pool_won"));context.put("cashAvailableWon",s.get("cash_available"));context.put("principal","만기 원금 별도 상환 의무 없음");context.put("tax","세전·세금과 수수료 미설정");context.put("dataVersion",s.get("digest"));context.put("sourceIds",List.of(id.toString(),e.get("id").toString()));context.put("mode","SIMULATION");
        return gateway.explain(a,id,question,context);
    }
    @PostMapping("/{id}/private-distribution") Object bojagi(@AuthenticationPrincipal WalletPrincipal a,@PathVariable UUID id) {
        work.requireOperator(a);work.settlement(a,id);throw new BusinessFailure("BOJAGI_NOT_CONNECTED",503,"Bojagi 공식 SDK·테스트 접근이 확보되지 않아 실제 분배를 제출하지 않았습니다.");
    }
}
