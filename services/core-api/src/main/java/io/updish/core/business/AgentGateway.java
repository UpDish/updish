package io.updish.core.business;

import io.updish.core.auth.WalletPrincipal;
import java.time.Duration;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.client.*;
import org.web3j.crypto.Hash;

@Service
public class AgentGateway {
    private final WorkbenchService work;private final JdbcTemplate db;private final RestClient client;private final String token;
    public AgentGateway(WorkbenchService work,JdbcTemplate db,@Value("${AGENT_API_URL:http://127.0.0.1:8000}") String url,@Value("${AGENT_SHARED_TOKEN:}") String token){
        this.work=work;this.db=db;this.token=token;var factory=new JdkClientHttpRequestFactory(java.net.http.HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build());factory.setReadTimeout(Duration.ofSeconds(50));client=RestClient.builder().baseUrl(url).requestFactory(factory).build();
    }
    public synchronized Object explain(WalletPrincipal actor,UUID settlementId,String question,Map<String,Object> context){
        // A payout can change without a sales revision; cache the complete authorized evidence context.
        var key=Hash.sha3String("presentation-v03.3:"+actor.address()+":"+work.encode(context)+":"+question);
        var cached=work.rows("SELECT result FROM agent_run WHERE address=? AND data_version=? AND status='SUCCESS' AND result IS NOT NULL ORDER BY created_at DESC LIMIT 1",actor.address(),key);
        if(!cached.isEmpty())return work.decode(cached.getFirst().get("result").toString());
        long count=db.queryForObject("SELECT count(*) FROM agent_run WHERE address=? AND created_at>now()-interval '1 day'",Long.class,actor.address());
        long global=db.queryForObject("SELECT count(*) FROM agent_run WHERE created_at>now()-interval '1 day'",Long.class);
        if(count>=20||global>=100)throw new BusinessFailure("AGENT_LIMIT",429,"오늘의 설명 요청 한도에 도달했습니다.");
        if(token.isBlank())throw new BusinessFailure("AGENT_NOT_CONFIGURED",503,"Agent 연결이 아직 설정되지 않았습니다.");
        var run=UUID.randomUUID();db.update("INSERT INTO agent_run(id,address,settlement_id,data_version,status) VALUES (?,?,?,?,'REQUESTED')",run,actor.address(),settlementId,key);
        try{
            var result=client.post().uri("/internal/explain").header("X-Updish-Agent-Token",token).body(Map.of("question",question,"context",context)).retrieve().body(new ParameterizedTypeReference<Map<String,Object>>(){});
            @SuppressWarnings("unchecked") var sources=(List<String>)context.get("sourceIds");
            if(result==null||!Objects.equals(result.get("dataVersion"),context.get("dataVersion"))||!(result.get("sourceIds") instanceof List<?> cited)||cited.isEmpty()||!sources.containsAll(cited))throw new BusinessFailure("AGENT_INVALID_RESPONSE",502,"설명의 근거를 확인하지 못했습니다.");
            db.update("UPDATE agent_run SET status='SUCCESS',result=?::jsonb WHERE id=?",work.encode(result),run);return result;
        }catch(RestClientException ex){db.update("UPDATE agent_run SET status='UNAVAILABLE' WHERE id=?",run);throw new BusinessFailure("AGENT_UNAVAILABLE",503,"답변을 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.");}
        catch(BusinessFailure ex){db.update("UPDATE agent_run SET status='INVALID' WHERE id=?",run);throw ex;}
    }
}
