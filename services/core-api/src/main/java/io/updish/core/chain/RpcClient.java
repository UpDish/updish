package io.updish.core.chain;

import java.net.URI;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Component
public final class RpcClient {
    private final RestClient client;
    private final AtomicLong sequence = new AtomicLong();

    public RpcClient(@Value("${updish.chain.rpc-url}") URI endpoint) {
        var http = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(3)).build();
        var factory = new JdkClientHttpRequestFactory(http);
        factory.setReadTimeout(Duration.ofSeconds(8));
        client = RestClient.builder().baseUrl(endpoint.toString()).requestFactory(factory).build();
    }

    public Object call(String method, List<?> params) {
        try {
            return callOnce(method, params);
        } catch (ChainFailure failure) {
            // Contract reverts are deterministic; retry only unavailable/malformed transport responses.
            if (failure.code().equals("RPC_REJECTED")) throw failure;
            try {
                Thread.sleep(350);
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
                throw new ChainFailure("RPC_UNAVAILABLE");
            }
            return callOnce(method, params);
        }
    }

    public Object callNullable(String method,List<?> params) {
        if(!List.of("eth_getTransactionByHash","eth_getTransactionReceipt").contains(method)) throw new IllegalArgumentException("Nullable RPC restricted to transaction lookup");
        try {return call(method,params);} catch(ChainFailure e) {
            if(e.code().equals("RPC_EMPTY_RESULT_"+method.toUpperCase(java.util.Locale.ROOT))) return null;
            throw e;
        }
    }

    private Object callOnce(String method, List<?> params) {
        long id = sequence.incrementAndGet();
        Map<String, Object> response;
        try {
            response = client.post().body(Map.of("jsonrpc", "2.0", "id", id,
                    "method", method, "params", params))
                .retrieve().body(new ParameterizedTypeReference<Map<String, Object>>() {});
        } catch (RestClientException ex) {
            throw new ChainFailure("RPC_UNAVAILABLE");
        }
        if (response == null || !(response.get("id") instanceof Number responseId)
                || responseId.longValue() != id || !"2.0".equals(response.get("jsonrpc"))) {
            throw new ChainFailure("RPC_INVALID_RESPONSE_" + method.toUpperCase(java.util.Locale.ROOT));
        }
        if (response.containsKey("error")) throw new ChainFailure("RPC_REJECTED");
        if (response.get("result") == null) throw new ChainFailure("RPC_EMPTY_RESULT_" + method.toUpperCase(java.util.Locale.ROOT));
        return response.get("result");
    }
}
