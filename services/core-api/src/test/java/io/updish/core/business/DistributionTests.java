package io.updish.core.business;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static io.updish.core.business.WorkbenchService.*;
import io.updish.core.auth.WalletPrincipal;
import io.updish.core.chain.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest @Transactional
class DistributionTests {
    @Autowired WorkbenchService work;@Autowired DistributionService distributions;@Autowired JdbcTemplate db;@MockitoBean GiwaService giwa;
    WalletPrincipal op,review,user,other;UUID offering;
    WalletPrincipal actor(String role){var id=UUID.randomUUID();var a="0x"+id.toString().replace("-","")+"00000000";db.update("INSERT INTO wallet_user(id,address,role) VALUES (?,?,?)",id,a,role);return new WalletPrincipal(id,a,role);}
    @BeforeEach void setup(){
        op=actor("OPERATOR");review=actor("REVIEWER");user=actor("INVESTOR");other=actor("INVESTOR");offering=uuid(work.reset(op),"id");
        when(giwa.verify(anyString())).thenAnswer(i->new GiwaService.Verification(i.getArgument(0),"VERIFIED_TESTNET",true,"TESTNET FAUCET",DojangCodec.FAUCET,"0x"+"11".repeat(32),"123","2026-10-31T00:00:00Z","SIMULATION","test","safe"));
        work.background(op);work.subscribe(user,offering,100,UUID.randomUUID(),true);work.allocate(op,offering);
        db.update("INSERT INTO distribution_config(offering_id,cash_address,vault_address,units_address,registry_address,checked_block) VALUES (?,?,?,?,?,1)",offering,"0x"+"11".repeat(20),"0x"+"22".repeat(20),"0x"+"33".repeat(20),"0x"+"44".repeat(20));
    }
    Map<String,Object> approve(String file,String month) throws Exception {
        var e=work.submitEvidence(op,offering,month,file+".csv",CsvReconciliationTests.fixture(file));work.closeEvidence(review,uuid(e,"id"),"대조 확인");var s=work.calculate(review,uuid(e,"id"),"산정");return work.approve(op,uuid(s,"id"),"별도 승인");
    }
    void registrySafe(UUID id){db.update("UPDATE chain_job SET status='SAFE' WHERE kind='SETTLEMENT' AND reference_id=?",id);}
    @Test void presentationContractAndAmountMatchSlides() throws Exception {
        var o=work.offering();assertEquals(10000,number(o,"target_units"));assertEquals(1000,number(o,"rate_bps"));assertEquals("presentation-v03",o.get("scenario_code"));
        var s=approve("normal","2026-10");assertEquals(3000000,number(s,"pool_won"));
        var line=work.one("SELECT * FROM settlement_line WHERE settlement_id=? AND address=?",uuid(s,"id"),user.address());assertEquals(30000,number(line,"amount_won"));
    }
    @Test void fundRequiresVerifiedRegistryAndCashAvailability() throws Exception {
        var s=approve("normal","2026-10");var id=uuid(s,"id");assertThrows(BusinessFailure.class,()->distributions.fund(op,id));
        registrySafe(id);var job=distributions.fund(op,id);assertEquals(job.get("id"),distributions.fund(op,id).get("id"));
        assertThrows(BusinessFailure.class,()->distributions.fund(user,id));
        var shortfall=approve("cash-shortage","2026-11");registrySafe(uuid(shortfall,"id"));assertThrows(BusinessFailure.class,()->distributions.fund(op,uuid(shortfall,"id")));
    }
    @Test void payoutRequiresMintAndFundingThenCreatesIdempotentPrivateReceipt() throws Exception {
        var s=approve("normal","2026-10");var id=uuid(s,"id");var line=work.one("SELECT * FROM settlement_line WHERE settlement_id=? AND address=?",id,user.address());var lineId=uuid(line,"id");
        assertThrows(BusinessFailure.class,()->distributions.pay(op,lineId));registrySafe(id);var fund=distributions.fund(op,id);db.update("UPDATE chain_job SET status='SAFE' WHERE id=?",uuid(fund,"id"));
        assertThrows(BusinessFailure.class,()->distributions.pay(op,lineId));db.update("UPDATE holding SET chain_units=units WHERE offering_id=? AND address=?",offering,user.address());
        var job=distributions.pay(op,lineId);assertEquals(job.get("id"),distributions.pay(op,lineId).get("id"));assertEquals(0,distributions.confirmed(offering,"2026-10",user.address()));
        assertEquals(List.of(),distributions.receipts(other).get("payments"));assertEquals(1,((List<?>)distributions.receipts(user).get("payments")).size());
        db.update("UPDATE chain_job SET status='SAFE' WHERE id=?",uuid(job,"id"));assertEquals(30000,distributions.confirmed(offering,"2026-10",user.address()));
        var background=work.one("SELECT id FROM settlement_line WHERE settlement_id=? AND address=?",id,BACKGROUND);assertThrows(BusinessFailure.class,()->distributions.pay(op,uuid(background,"id")));
    }
    @Test void pendingPaymentBlocksRevisionFundingAndCorrectionPreservesReceipt() throws Exception {
        var s=approve("normal","2026-10");var id=uuid(s,"id");registrySafe(id);var fund=distributions.fund(op,id);db.update("UPDATE chain_job SET status='SAFE' WHERE id=?",uuid(fund,"id"));db.update("UPDATE holding SET chain_units=units WHERE offering_id=? AND address=?",offering,user.address());
        var line=work.one("SELECT id FROM settlement_line WHERE settlement_id=? AND address=?",id,user.address());var pay=distributions.pay(op,uuid(line,"id"));
        var revised=approve("correction","2026-10");var revisedId=uuid(revised,"id");registrySafe(revisedId);assertThrows(BusinessFailure.class,()->distributions.fund(op,revisedId));
        db.update("UPDATE chain_job SET status='SAFE' WHERE id=?",uuid(pay,"id"));var funding=distributions.fund(op,revisedId);db.update("UPDATE chain_job SET status='SAFE' WHERE id=?",uuid(funding,"id"));
        var newLine=work.one("SELECT id FROM settlement_line WHERE settlement_id=? AND address=?",revisedId,user.address());assertThrows(BusinessFailure.class,()->distributions.pay(op,uuid(newLine,"id")));assertEquals(30000,distributions.confirmed(offering,"2026-10",user.address()));
    }
}
