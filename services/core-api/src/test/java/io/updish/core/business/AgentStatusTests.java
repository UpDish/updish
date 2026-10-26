package io.updish.core.business;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.sun.net.httpserver.HttpServer;
import io.updish.core.auth.WalletPrincipal;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class AgentStatusTests {
    @Test void capabilityReadsNeverTurnMissingConfigurationOrFailureIntoAConfiguredModel() throws Exception {
        var code=new AtomicInteger(200);var configured=new java.util.concurrent.atomic.AtomicBoolean(false);
        var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/capabilities",exchange->{var body=("{\"model_calls\":\""+(configured.get()?"CONFIGURED":"NOT_CONFIGURED")+"\"}").getBytes(StandardCharsets.UTF_8);exchange.getResponseHeaders().set("Content-Type","application/json");exchange.sendResponseHeaders(code.get(),body.length);try(var output=exchange.getResponseBody()){output.write(body);}});server.start();
        try{var work=mock(WorkbenchService.class);var actor=new WalletPrincipal(UUID.randomUUID(),"0x"+"11".repeat(20),"INVESTOR");when(work.role(actor)).thenReturn("INVESTOR");var controller=new AgentStatusController(work,"http://127.0.0.1:"+server.getAddress().getPort());
            assertEquals(Map.of("modelCalls","NOT_CONFIGURED","status","REACHABLE","mode","SIMULATION"),controller.status(actor));configured.set(true);assertEquals("CONFIGURED",((Map<?,?>)controller.status(actor)).get("modelCalls"));code.set(503);assertEquals("UNAVAILABLE",((Map<?,?>)controller.status(actor)).get("modelCalls"));verify(work,times(3)).role(actor);
        }finally{server.stop(0);}
    }
}
