package io.updish.core.business;
import static org.junit.jupiter.api.Assertions.*;
import com.sun.net.httpserver.HttpServer;
import io.updish.core.auth.WalletPrincipal;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.atomic.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest @Transactional
class AgentGatewayTests {
    @Autowired WorkbenchService work;@Autowired JdbcTemplate db;
    WalletPrincipal actor(){var id=UUID.randomUUID();var address="0x"+id.toString().replace("-","")+"00000000";db.update("INSERT INTO wallet_user(id,address,role) VALUES (?,?,'INVESTOR')",id,address);return new WalletPrincipal(id,address,"INVESTOR");}
    @Test void publicChatIsAuditedCachedPerWalletAndRejectsInventedSources() throws Exception {
        var calls=new AtomicInteger();var bad=new AtomicBoolean();var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/internal/explain",exchange->{calls.incrementAndGet();var body=work.decode(new String(exchange.getRequestBody().readAllBytes(),StandardCharsets.UTF_8));var context=(Map<?,?>)body.get("context");var result=work.encode(Map.of("explanation","자료 대조 설명","sourceIds",List.of(bad.get()?"private-other-user":"sample-source"),"dataVersion",context.get("dataVersion"),"mode","SIMULATION"));var bytes=result.getBytes(StandardCharsets.UTF_8);exchange.getResponseHeaders().set("Content-Type","application/json");exchange.sendResponseHeaders(200,bytes.length);try(var output=exchange.getResponseBody()){output.write(bytes);}});server.start();
        try{
            var gateway=new AgentGateway(work,db,"http://127.0.0.1:"+server.getAddress().getPort(),"test-only");var first=actor();var other=actor();var context=Map.<String,Object>of("sourceIds",List.of("sample-source"),"dataVersion","v1");
            var answer=gateway.explain(first,null,"매출 대조",context);assertEquals(answer,gateway.explain(first,null,"매출 대조",context));assertEquals(1,calls.get());gateway.explain(other,null,"매출 대조",context);assertEquals(2,calls.get());
            bad.set(true);assertEquals(502,assertThrows(BusinessFailure.class,()->gateway.explain(first,null,"다른 질문",context)).status());assertEquals(1,db.queryForObject("SELECT count(*) FROM agent_run WHERE address=? AND settlement_id IS NULL AND status='INVALID'",Integer.class,first.address()));
            assertEquals(1,db.queryForObject("SELECT count(*) FROM agent_run WHERE address=? AND settlement_id IS NULL AND status='SUCCESS'",Integer.class,first.address()));
        }finally{server.stop(0);}
    }
}
