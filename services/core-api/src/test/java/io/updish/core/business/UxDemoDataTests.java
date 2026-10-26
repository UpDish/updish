package io.updish.core.business;
import static org.junit.jupiter.api.Assertions.*;
import static io.updish.core.business.UxDemoIntegrityTests.rows;
import io.updish.core.auth.WalletPrincipal;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest @Transactional
class UxDemoDataTests {
    @Autowired UxDemoDataService service;@Autowired JdbcTemplate db;
    WalletPrincipal actor(String role){var id=UUID.randomUUID();var address="0x"+id.toString().replace("-","")+"00000000";db.update("INSERT INTO wallet_user(id,address,role) VALUES (?,?,?)",id,address,role);return new WalletPrincipal(id,address,role);}
    @SuppressWarnings("unchecked") Map<String,Object> section(Map<String,Object> view,String key){return (Map<String,Object>)view.get(key);}
    @Test void seedIsIdempotentAndDoesNotAddBusinessLedgerRecordsOrRoles() throws Exception {
        var tables=List.of("wallet_user","offering","subscription","holding","evidence","settlement","payment_attempt","chain_job");var counts=new HashMap<String,Long>();for(var t:tables)counts.put(t,db.queryForObject("SELECT count(*) FROM "+t,Long.class));
        var run=db.queryForObject("SELECT run_id FROM demo_state WHERE singleton=true",UUID.class);service.seed();service.seed();
        assertEquals(1,db.queryForObject("SELECT count(*) FROM ux_demo_dataset WHERE dataset_id=?",Integer.class,UxDemoDataService.DATASET_ID));
        for(var t:tables)assertEquals(counts.get(t),db.queryForObject("SELECT count(*) FROM "+t,Long.class));assertEquals(run,db.queryForObject("SELECT run_id FROM demo_state WHERE singleton=true",UUID.class));
    }
    @Test void ordinaryUsersAndSpoofedPrincipalRolesCannotSelectFixturePersonas(){
        var investor=actor("INVESTOR");assertThrows(BusinessFailure.class,()->service.dataset(investor));assertThrows(BusinessFailure.class,()->service.persona(investor,"operator"));
        assertThrows(BusinessFailure.class,()->service.dataset(new WalletPrincipal(investor.id(),investor.address(),"OPERATOR")));
    }
    @Test void investorAndCustomerViewsExposeOnlyTheirOwnPrivateExamples(){
        var op=actor("OPERATOR");var active=service.persona(op,"investor-active");var empty=service.persona(op,"investor-new");var customer=service.persona(op,"customer-only");
        assertEquals(4,rows(section(active,"portfolio"),"holdings").size());assertTrue(rows(section(empty,"portfolio"),"holdings").isEmpty());assertTrue(rows(section(customer,"portfolio"),"subscriptions").isEmpty());
        for(var key:List.of("subscriptions","holdings","lines","payments"))for(var row:rows(section(active,"portfolio"),key))assertEquals("investor-active",row.get("personaId"));
        assertTrue(rows(section(active,"portfolio"),"settlements").stream().allMatch(s->"APPROVED_SAMPLE".equals(s.get("status"))));
        assertTrue(rows(section(customer,"storeManagement"),"stores").isEmpty());assertTrue(rows(section(customer,"customerBenefits"),"claims").stream().allMatch(c->"customer-only".equals(c.get("personaId"))));
        assertEquals(List.of("MARKET","INVESTMENTS","BENEFITS"),customer.get("availableSections"));
        assertEquals("OPERATOR",db.queryForObject("SELECT role FROM wallet_user WHERE id=?",String.class,op.id()));
    }
    @Test void merchantOwnershipAndReviewOperationsRemainDistinct(){
        var op=actor("OPERATOR");var owner=service.persona(op,"merchant-seongsu");var group=service.persona(op,"merchant-group");var review=service.persona(op,"reviewer");var admin=service.persona(op,"operator");
        assertEquals(1,rows(section(owner,"storeManagement"),"stores").size());assertEquals(7,rows(section(group,"storeManagement"),"stores").size());
        for(var key:List.of("offerings","evidence","revenues","exceptionSources","settlements","benefits"))for(var row:rows(section(owner,"storeManagement"),key))assertEquals("store-seongsu",row.get("storeId"));
        assertTrue(rows(owner,"reviewQueue").isEmpty());assertEquals(5,rows(review,"reviewQueue").size());assertTrue(rows(section(review,"operations"),"settlements").isEmpty());assertEquals(7,rows(section(admin,"operations"),"settlements").size());
        assertThrows(BusinessFailure.class,()->service.persona(op,"background"));assertThrows(BusinessFailure.class,()->service.persona(op,"unknown"));
    }
}
