package io.updish.core.business;
import io.updish.core.auth.WalletPrincipal;
import static io.updish.core.business.WorkbenchService.*;
import java.time.Duration;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.web3j.crypto.Hash;

@RestController
@RequestMapping("/api/v1/workbench/settlements")
public class AgentController {
    private final WorkbenchService work;private final JdbcTemplate db;private final RestClient client;private final String token;
    public AgentController(WorkbenchService work,JdbcTemplate db,@Value("${AGENT_API_URL:http://127.0.0.1:8000}") String url,@Value("${AGENT_SHARED_TOKEN:}") String token) {
        this.work=work;this.db=db;this.token=token;var factory=new JdkClientHttpRequestFactory(java.net.http.HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build());factory.setReadTimeout(Duration.ofSeconds(50));this.client=RestClient.builder().baseUrl(url).requestFactory(factory).build();
    }
    public record Question(String question) {}
    @PostMapping("/{id}/explain") Object explain(@AuthenticationPrincipal WalletPrincipal a,@PathVariable UUID id,@RequestBody Question b) {
        var question=reason(b.question());var s=work.settlement(a,id);
        var lines=work.rows("SELECT id,units,amount_won,paid_won,prior_paid_won,delta_won FROM settlement_line WHERE settlement_id=? AND address=?",id,a.address());
        if(lines.isEmpty()) throw BusinessFailure.forbidden();if(!s.get("status").equals("APPROVED")) throw BusinessFailure.conflict("승인된 정산의 근거를 설명합니다.");
        var key=Hash.sha3String(a.address()+":"+s.get("digest")+":"+question);
        var cached=work.rows("SELECT result FROM agent_run WHERE address=? AND data_version=? AND status=? AND result IS NOT NULL ORDER BY created_at DESC LIMIT 1",a.address(),key,"SUCCESS");
        if(!cached.isEmpty()) return work.decode(cached.getFirst().get("result").toString());
        long count=db.queryForObject("SELECT count(*) FROM agent_run WHERE address=? AND created_at>now()-interval '1 day'",Long.class,a.address());
        long global=db.queryForObject("SELECT count(*) FROM agent_run WHERE created_at>now()-interval '1 day'",Long.class);
        if(count>=20||global>=100) throw new BusinessFailure("AGENT_LIMIT",429,"오늘의 설명 요청 한도에 도달했습니다.");
        if(token.isBlank()) throw new BusinessFailure("AGENT_NOT_CONFIGURED",503,"Agent 내부 연결이 아직 설정되지 않았습니다.");
        var o=work.one("SELECT title,contract_version,rate_bps,months FROM offering WHERE id=?",uuid(s,"offering_id"));
        var e=work.one("SELECT id,report,source_hash FROM evidence WHERE id=?",uuid(s,"evidence_id"));
        var context=new LinkedHashMap<String,Object>();context.put("contract",o);context.put("reconciliation",e.get("report"));context.put("ownLines",lines);
        context.put("period",s.get("period"));context.put("poolWon",s.get("pool_won"));context.put("cashAvailableWon",s.get("cash_available"));context.put("principal","만기 원금 별도 상환 의무 없음");context.put("tax","세전·세금과 수수료 미설정");context.put("dataVersion",s.get("digest"));context.put("sourceIds",List.of(id.toString(),e.get("id").toString()));context.put("mode","SIMULATION");
        var run=UUID.randomUUID();db.update("INSERT INTO agent_run(id,address,settlement_id,data_version,status) VALUES (?,?,?,?,'REQUESTED')",run,a.address(),id,key);
        try {
            var result=client.post().uri("/internal/explain").header("X-Updish-Agent-Token",token).body(Map.of("question",question,"context",context)).retrieve().body(new ParameterizedTypeReference<Map<String,Object>>(){});
            if(result==null||!Objects.equals(result.get("dataVersion"),s.get("digest"))) throw new BusinessFailure("AGENT_INVALID_RESPONSE",502,"설명 데이터 버전이 일치하지 않습니다.");
            db.update("UPDATE agent_run SET status='SUCCESS',result=?::jsonb WHERE id=?",work.encode(result),run);return result;
        } catch(RestClientException ex) {db.update("UPDATE agent_run SET status='UNAVAILABLE' WHERE id=?",run);throw new BusinessFailure("AGENT_UNAVAILABLE",503,"Agent를 사용할 수 없습니다. API 키와 연결 상태를 확인해 주세요. 정산 업무는 계속 사용할 수 있습니다.");}
    }
    @PostMapping("/{id}/private-distribution") Object bojagi(@AuthenticationPrincipal WalletPrincipal a,@PathVariable UUID id) {
        work.requireOperator(a);work.settlement(a,id);throw new BusinessFailure("BOJAGI_NOT_CONNECTED",503,"Bojagi 공식 SDK·테스트 접근이 확보되지 않아 실제 분배를 제출하지 않았습니다.");
    }
}
