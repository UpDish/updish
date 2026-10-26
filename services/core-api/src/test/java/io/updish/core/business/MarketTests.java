package io.updish.core.business;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static io.updish.core.business.WorkbenchService.*;
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
class MarketTests {
    @Autowired TransparencyService transparency;@Autowired MarketService market;@Autowired WorkbenchService work;@Autowired JdbcTemplate db;@MockitoBean GiwaService giwa;
    @Autowired org.springframework.transaction.PlatformTransactionManager transactions;
    WalletPrincipal actor(){var id=UUID.randomUUID();var address="0x"+id.toString().replace("-","")+"00000000";db.update("INSERT INTO wallet_user(id,address,role) VALUES (?,?,'INVESTOR')",id,address);return new WalletPrincipal(id,address,"INVESTOR");}
    @SuppressWarnings("unchecked") List<Map<String,Object>> rows(Map<String,Object> d,String key){return (List<Map<String,Object>>)d.get(key);}
    @SuppressWarnings("unchecked") Map<String,Object> offering(Map<String,Object> l){return (Map<String,Object>)l.get("offering");}
    void verified(){when(giwa.verify(anyString())).thenAnswer(i->new GiwaService.Verification(i.getArgument(0),"VERIFIED_TESTNET",true,"TESTNET FAUCET",DojangCodec.FAUCET,"0x"+"11".repeat(32),"123","2026-10-26T00:00:00Z","SIMULATION","mock-local","safe"));}
    @Test @Transactional(propagation=org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    void getEndpointsWorkInRealReadOnlyPostgresTransactions(){
        var user=actor();try{var tx=new org.springframework.transaction.support.TransactionTemplate(transactions);tx.setReadOnly(true);tx.execute(status->{assertEquals(8,rows(market.catalog(user),"listings").size());assertFalse(rows(transparency.read(user,"store-seongsu"),"samples").isEmpty());return null;});}finally{db.update("DELETE FROM wallet_user WHERE id=?",user.id());}
    }
    @Test void catalogIsAvailableToOrdinaryUsersAndPreservesActiveRunAndLedger(){
        var user=actor();var id=work.offering().get("id");var run=work.runId();var subs=db.queryForObject("SELECT count(*) FROM subscription",Long.class);
        var catalog=rows(market.catalog(user),"listings");assertEquals(8,catalog.size());assertEquals(id,offering(catalog.getFirst()).get("id"));assertEquals(3,catalog.stream().filter(l->l.get("offering")!=null).count());
        assertEquals(8,rows(market.catalog(user),"listings").size());assertEquals(2,db.queryForObject("SELECT count(*) FROM market_offering",Integer.class));assertEquals(run,work.runId());assertEquals(id,work.offering().get("id"));assertEquals(subs,db.queryForObject("SELECT count(*) FROM subscription",Long.class));
        assertTrue(catalog.stream().allMatch(l->!l.containsKey("personas")&&!l.containsKey("claims")));
    }
    @Test void chosenStoreUsesItsOwnTermsAndWalletPortfolioAcrossStores(){
        verified();var user=actor();var other=actor();var listings=rows(market.catalog(user),"listings");var bakery=offering(listings.get(2));var pasta=offering(listings.get(1));
        assertEquals(6000,number(bakery,"target_units"));assertEquals("5000",bakery.get("unit_price"));
        var key=UUID.randomUUID();var sub=work.subscribe(user,uuid(bakery,"id"),4000,key,true);assertEquals(sub.get("id"),work.subscribe(user,uuid(bakery,"id"),4000,key,true).get("id"));
        work.subscribe(user,uuid(pasta,"id"),10,UUID.randomUUID(),true);var mine=rows(market.portfolio(user),"subscriptions");assertEquals(2,mine.size());assertTrue(rows(market.portfolio(other),"subscriptions").isEmpty());
        assertEquals(0,rows(market.portfolio(user),"holdings").size());assertThrows(BusinessFailure.class,()->work.cancel(other,uuid(sub,"id")));
        work.cancel(user,uuid(sub,"id"));assertEquals("CANCELLED",rows(market.portfolio(user),"subscriptions").stream().filter(s->s.get("id").equals(sub.get("id"))).findFirst().orElseThrow().get("status"));
        assertThrows(BusinessFailure.class,()->work.subscribe(user,uuid(bakery,"id"),6001,UUID.randomUUID(),true));
    }
    @Test void newListingDoesNotBypassDojangAndCannotUseAnArbitraryOldOffering(){
        var user=actor();var listings=rows(market.catalog(user),"listings");var id=uuid(offering(listings.get(1)),"id");
        when(giwa.verify(user.address())).thenThrow(new ChainFailure("RPC_UNAVAILABLE"));assertThrows(ChainFailure.class,()->work.subscribe(user,id,1,UUID.randomUUID(),true));assertTrue(rows(market.portfolio(user),"subscriptions").isEmpty());
        assertThrows(BusinessFailure.class,()->work.subscribe(user,UUID.randomUUID(),1,UUID.randomUUID(),true));
    }
    @Test void removedCustomerEndpointsCannotIssueCoupons(){
        var c=new MarketController(market);var before=db.queryForObject("SELECT count(*) FROM benefit_claim",Long.class);
        assertEquals(410,assertThrows(BusinessFailure.class,c::removedBenefits).status());assertEquals(410,assertThrows(BusinessFailure.class,c::removedClaim).status());
        assertEquals(before,db.queryForObject("SELECT count(*) FROM benefit_claim",Long.class));
    }
}
