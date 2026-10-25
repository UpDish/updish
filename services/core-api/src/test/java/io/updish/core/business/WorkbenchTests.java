package io.updish.core.business;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static io.updish.core.business.WorkbenchService.*;
import io.updish.core.auth.WalletPrincipal;
import io.updish.core.chain.*;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Transactional
class WorkbenchTests {
    @Autowired WorkbenchService work;@Autowired JdbcTemplate db;@MockitoBean GiwaService giwa;
    WalletPrincipal operator,reviewer,investor,other;UUID offering;
    WalletPrincipal actor(String role) {var id=UUID.randomUUID();var address="0x"+id.toString().replace("-","")+"00000000";db.update("INSERT INTO wallet_user(id,address,role) VALUES (?,?,?)",id,address,role);return new WalletPrincipal(id,address,role);}
    @BeforeEach void setup() {
        operator=actor("OPERATOR");reviewer=actor("REVIEWER");investor=actor("INVESTOR");other=actor("INVESTOR");
        offering=uuid(work.reset(operator),"id");
        when(giwa.verify(anyString())).thenAnswer(inv->new GiwaService.Verification(inv.getArgument(0),"VERIFIED_TESTNET",true,"TESTNET FAUCET",DojangCodec.FAUCET,"0x"+"11".repeat(32),"123","2026-10-25T00:00:00Z","SIMULATION","test","safe"));
    }
    UUID funded() {
        work.background(operator);var key=UUID.randomUUID();var subscription=work.subscribe(investor,offering,100,key,true);
        assertEquals(subscription.get("id"),work.subscribe(investor,offering,100,key,true).get("id"));
        assertEquals(0,db.queryForObject("SELECT count(*) FROM holding WHERE offering_id=?",Integer.class,offering));
        work.allocate(operator,offering);return uuid(subscription,"id");
    }
    Map<String,Object> settlement(String fixture,String period) throws Exception {
        var e=work.submitEvidence(operator,offering,period,fixture+".csv",CsvReconciliationTests.fixture(fixture));work.closeEvidence(reviewer,uuid(e,"id"),"검토 완료");var s=work.calculate(reviewer,uuid(e,"id"),"근거 산정");return work.approve(operator,uuid(s,"id"),"산정자와 별도 승인");
    }
    @Test void fullFlowSeparatesSubscriptionHoldingChainAndPayment() throws Exception {
        funded();var s=settlement("normal","2026-10");
        var mine=work.settlement(investor,uuid(s,"id"));@SuppressWarnings("unchecked") var lines=(List<Map<String,Object>>)mine.get("lines");var line=lines.getFirst();assertEquals("25000",line.get("amount_won"));assertEquals("900000",s.get("pool_won"));
        assertEquals(2,db.queryForObject("SELECT count(*) FROM chain_job WHERE run_id=?",Integer.class,work.runId()));
        assertEquals(0,db.queryForObject("SELECT sum(chain_units) FROM holding WHERE offering_id=?",Integer.class,offering));
        var key=UUID.randomUUID();var pay=work.pay(operator,uuid(line,"id"),25000,"SUCCESS",key);assertEquals(pay.get("id"),work.pay(operator,uuid(line,"id"),25000,"SUCCESS",key).get("id"));
        assertEquals(25000,db.queryForObject("SELECT paid_won FROM settlement_line WHERE id=?",Long.class,uuid(line,"id")));
        assertThrows(BusinessFailure.class,()->work.pay(operator,uuid(line,"id"),1,"SUCCESS",UUID.randomUUID()));
    }
    @Test void roleIsolationAndFourEyesAreEnforced() throws Exception {
        var e=work.submitEvidence(operator,offering,"2026-10","normal.csv",CsvReconciliationTests.fixture("normal"));
        assertThrows(BusinessFailure.class,()->work.closeEvidence(operator,uuid(e,"id"),"self"));assertThrows(BusinessFailure.class,()->work.evidence(investor,uuid(e,"id")));
        assertThrows(BusinessFailure.class,()->work.member(investor,other.address(),"REVIEWER",false));
    }
    @Test void unverifiedAndRpcFailuresCannotSubscribe() {
        when(giwa.verify(investor.address())).thenReturn(new GiwaService.Verification(investor.address(),"NOT_VERIFIED",false,"TESTNET FAUCET",DojangCodec.FAUCET,null,"123","2026-10-25T00:00:00Z","SIMULATION","test","safe"));
        assertThrows(BusinessFailure.class,()->work.subscribe(investor,offering,100,UUID.randomUUID(),true));
        when(giwa.verify(other.address())).thenThrow(new ChainFailure("RPC_UNAVAILABLE"));assertThrows(ChainFailure.class,()->work.subscribe(other,offering,100,UUID.randomUUID(),true));
        assertEquals(0,db.queryForObject("SELECT count(*) FROM subscription WHERE offering_id=?",Integer.class,offering));
    }
    @Test void overAllocationAndUnderfundedRefundPreserveNoHolding() {
        var sub=work.subscribe(investor,offering,100,UUID.randomUUID(),true);assertThrows(BusinessFailure.class,()->work.allocate(operator,offering));
        work.underfunded(operator,offering);assertEquals("REFUNDED",db.queryForObject("SELECT status FROM subscription WHERE id=?",String.class,uuid(sub,"id")));
        assertEquals(0,db.queryForObject("SELECT count(*) FROM holding WHERE offering_id=?",Integer.class,offering));
    }
    @Test void cashShortageKeepsObligationAndRejectsOverspend() throws Exception {
        funded();var s=settlement("cash-shortage","2026-11");assertEquals("720000",s.get("pool_won"));assertEquals("300000",s.get("cash_available"));
        var bg=work.one("SELECT * FROM settlement_line WHERE settlement_id=? AND address=?",uuid(s,"id"),BACKGROUND);
        assertThrows(BusinessFailure.class,()->work.pay(operator,uuid(bg,"id"),number(bg,"amount_won"),"SUCCESS",UUID.randomUUID()));
    }
    @Test void correctionKeepsPaymentsAndMaturityKeepsClaims() throws Exception {
        funded();var first=settlement("normal","2026-10");var line=work.one("SELECT * FROM settlement_line WHERE settlement_id=? AND address=?",uuid(first,"id"),investor.address());work.pay(operator,uuid(line,"id"),25000,"SUCCESS",UUID.randomUUID());
        var correction=settlement("correction","2026-10");var revised=work.one("SELECT * FROM settlement_line WHERE settlement_id=? AND address=?",uuid(correction,"id"),investor.address());
        assertEquals("25000",revised.get("prior_paid_won"));assertEquals("-833",revised.get("delta_won"));assertEquals("24167",revised.get("amount_won"));
        assertThrows(BusinessFailure.class,()->work.settlement(other,uuid(correction,"id")));work.mature(operator,offering);assertEquals(2,db.queryForObject("SELECT count(*) FROM settlement WHERE offering_id=?",Integer.class,offering));
        assertThrows(BusinessFailure.class,()->work.pay(operator,uuid(line,"id"),1,"SUCCESS",UUID.randomUUID()));
    }
    @Test void digestTamperingAndMissingEvidenceFailHonestly() throws Exception {
        funded();var s=settlement("normal","2026-10");assertEquals(true,work.digestCheck(operator,uuid(s,"id"),false).get("matches"));assertEquals(false,work.digestCheck(operator,uuid(s,"id"),true).get("matches"));
        var missing=work.submitEvidence(operator,offering,"2026-10","missing.csv",CsvReconciliationTests.fixture("missing-bank"));assertEquals("BLOCKED",missing.get("status"));assertThrows(BusinessFailure.class,()->work.closeEvidence(reviewer,uuid(missing,"id"),"자료 누락"));
    }
}
