package io.updish.core.business;

import io.updish.core.auth.WalletPrincipal;
import java.time.Duration;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@RestController
@RequestMapping("/api/v1/workbench/agent")
public class AgentStatusController {
    private final WorkbenchService work;private final RestClient client;
    public AgentStatusController(WorkbenchService work,@Value("${AGENT_API_URL:http://127.0.0.1:8000}") String url){
        this.work=work;var factory=new JdkClientHttpRequestFactory(java.net.http.HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build());factory.setReadTimeout(Duration.ofSeconds(3));this.client=RestClient.builder().baseUrl(url).requestFactory(factory).build();
    }
    @GetMapping("/status") Object status(@AuthenticationPrincipal WalletPrincipal actor){
        work.role(actor);
        try{var c=client.get().uri("/capabilities").retrieve().body(new ParameterizedTypeReference<Map<String,Object>>(){});return Map.of("modelCalls",c!=null&&"CONFIGURED".equals(c.get("model_calls"))?"CONFIGURED":"NOT_CONFIGURED","status","REACHABLE","mode","SIMULATION");}
        catch(RestClientException ex){return Map.of("modelCalls","UNAVAILABLE","status","UNAVAILABLE","mode","SIMULATION");}
    }
}
