package io.updish.core.chain;

import static org.assertj.core.api.Assertions.*;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.IntFunction;
import java.util.regex.Pattern;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class RpcClientTests {
    HttpServer server;
    AtomicInteger requests = new AtomicInteger();

    RpcClient client(IntFunction<String> reply) throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            String request = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            var match = Pattern.compile("\"id\"\\s*:\\s*(\\d+)").matcher(request);
            if (!match.find()) throw new IllegalStateException("Missing request ID");
            int id = Integer.parseInt(match.group(1));
            requests.incrementAndGet();
            byte[] body = reply.apply(id).getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            try (var output = exchange.getResponseBody()) { output.write(body); }
        });
        server.start();
        return new RpcClient(URI.create("http://127.0.0.1:" + server.getAddress().getPort()));
    }

    @AfterEach
    void stop() { if (server != null) server.stop(0); }

    @Test
    void retriesOneEmptyReplyAndPreservesRequestIdentity() throws Exception {
        var rpc = client(id -> "{\"jsonrpc\":\"2.0\",\"id\":" + id
                + ",\"result\":" + (requests.get() == 1 ? "null" : "\"0x164ce\"") + "}");
        assertThat(rpc.call("eth_chainId", List.of())).isEqualTo("0x164ce");
        assertThat(requests.get()).isEqualTo(2);
    }

    @Test
    void contractRevertIsNotRetriedOrConvertedToFalse() throws Exception {
        var rpc = client(id -> "{\"jsonrpc\":\"2.0\",\"id\":" + id
                + ",\"error\":{\"code\":-32000,\"message\":\"reverted\"}}");
        assertThatThrownBy(() -> rpc.call("eth_call", List.of())).isInstanceOf(ChainFailure.class)
                .satisfies(error -> assertThat(((ChainFailure) error).code()).isEqualTo("RPC_REJECTED"));
        assertThat(requests.get()).isEqualTo(1);
    }

    @Test
    void mismatchedResponseIdNeverBecomesAValidRead() throws Exception {
        var rpc = client(id -> "{\"jsonrpc\":\"2.0\",\"id\":999,\"result\":\"0x164ce\"}");
        assertThatThrownBy(() -> rpc.call("eth_chainId", List.of())).isInstanceOf(ChainFailure.class);
        assertThat(requests.get()).isEqualTo(2);
    }
}
