package io.updish.core.business;
import static org.junit.jupiter.api.Assertions.*;
import static io.updish.core.business.WorkbenchService.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import io.updish.core.auth.WalletPrincipal;
import io.updish.core.chain.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest @Transactional
class TransparencyTests {
    @Autowired TransparencyService service;@Autowired WorkbenchService work;@Autowired JdbcTemplate db;@Autowired AgentChatController chat;@MockitoBean GiwaService giwa;
    WalletPrincipal actor(String role){var id=UUID.randomUUID();var address="0x"+id.toString().replace("-","")+"00000000";db.update("INSERT INTO wallet_user(id,address,role) VALUES (?,?,?)",id,address,role);return new WalletPrincipal(id,address,role);}
    @SuppressWarnings("unchecked") List<Map<String,Object>> rows(Map<String,Object> d,String key){return (List<Map<String,Object>>)d.get(key);}
    @SuppressWarnings("unchecked") Map<String,Object> report(Map<String,Object> item){return (Map<String,Object>)item.get("reconciliation");}
    @Test void syntheticCasesUseActualCsvAndNeverTreatMissingBankAsZero(){
        var user=actor("INVESTOR");var normal=rows(service.read(user,"store-seongsu"),"samples").getFirst();assertEquals("30000000",report(normal).get("netWon"));assertEquals(true,report(normal).get("ready"));assertNull(normal.get("settlementId"));assertNull(normal.get("digest"));
        var missing=rows(service.read(user,"store-mangwon"),"samples").getLast();assertNull(report(missing).get("bankWon"));assertNull(report(missing).get("bankGapWon"));assertEquals("BLOCKED",missing.get("status"));
        var mismatch=rows(service.read(user,"store-hapjeong"),"samples").getLast();assertEquals(false,report(mismatch).get("ready"));assertNotEquals("0",report(mismatch).get("pgGapWon"));
        var correction=rows(service.read(user,"store-eulji"),"samples").getLast();assertEquals("31400000",report(correction).get("netWon"));assertEquals("SYNTHETIC_CSV",correction.get("basis"));
        for(var item:List.of(normal,missing,mismatch,correction)){assertEquals(64,item.get("sourceHash").toString().length());assertFalse(item.toString().contains("eventId"));}
        assertThrows(BusinessFailure.class,()->service.read(user,"unknown"));
    }
    @Test void publicAndAgentContextsKeepDraftAmountsAndPrivateCustomerDataOut() throws Exception {
        var op=actor("OPERATOR");var reviewer=actor("REVIEWER");var investor=actor("INVESTOR");var o=uuid(work.reset(op),"id");
        when(giwa.verify(anyString())).thenAnswer(i->new GiwaService.Verification(i.getArgument(0),"VERIFIED_TESTNET",true,"TESTNET FAUCET",DojangCodec.FAUCET,"0x"+"11".repeat(32),"123","2026-10-26T00:00:00Z","SIMULATION","local","safe"));
        work.background(op);work.subscribe(investor,o,100,UUID.randomUUID(),true);work.allocate(op,o);
        var e=work.submitEvidence(op,o,"2026-10","private-customer.csv",CsvReconciliationTests.fixture("normal"));work.closeEvidence(reviewer,uuid(e,"id"),"private-review-note");var s=work.calculate(reviewer,uuid(e,"id"),"calculate");work.approve(op,uuid(s,"id"),"approve");
        work.submitEvidence(op,o,"2026-10","private-correction.csv",CsvReconciliationTests.fixture("correction"));
        var result=service.read(investor,"store-seongsu");assertEquals(1,rows(result,"approved").size());assertEquals("30000000",report(rows(result,"approved").getFirst()).get("netWon"));
        var serialized=work.encode(result);for(var secret:List.of("29000000","private-customer","private-correction","private-review-note",investor.address(),"ownLines","eventId"))assertFalse(serialized.contains(secret),secret);
        var context=chat.context(investor,"store-seongsu");assertEquals(context.get("dataVersion"),chat.context(investor,"store-seongsu").get("dataVersion"));var raw=work.encode(context);assertFalse(raw.contains("29000000"));assertFalse(raw.contains(investor.address()));assertTrue(raw.contains("SYNTHETIC_CSV"));assertTrue(raw.contains("APPROVED_LEDGER"));
    }
}
