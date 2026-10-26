package io.updish.core.business;
import static org.junit.jupiter.api.Assertions.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.*;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class UxDemoIntegrityTests {
    @SuppressWarnings("unchecked") static Map<String,Object> data() throws Exception {try(var s=UxDemoIntegrityTests.class.getResourceAsStream("/demo/ux-dataset.json")){return new ObjectMapper().readValue(s,Map.class);}}
    @SuppressWarnings("unchecked") static List<Map<String,Object>> rows(Map<String,Object> d,String key){return (List<Map<String,Object>>)d.get(key);}
    static long n(Map<String,Object> row,String key){return Long.parseLong(row.get(key).toString());}
    static Map<String,Map<String,Object>> index(Map<String,Object> d,String key){return rows(d,key).stream().collect(Collectors.toMap(r->(String)r.get("id"),r->r));}
    @Test void identitiesReferencesAndSyntheticProofBoundariesAreConsistent() throws Exception {
        var d=data();assertEquals("SIMULATION",d.get("mode"));assertEquals("SYNTHETIC_UX_FIXTURE",d.get("source"));
        assertEquals(8,rows(d,"stores").size());assertEquals(8,rows(d,"personas").size());assertEquals(7,rows(d,"personas").stream().filter(p->Boolean.TRUE.equals(p.get("selectable"))).count());
        var people=index(d,"personas");var stores=index(d,"stores");var offerings=index(d,"offerings");var holds=index(d,"holdings");var settlements=index(d,"settlements");var benefits=index(d,"benefits");
        for(var key:List.of("personas","stores","offerings","subscriptions","holdings","revenues","exceptionSources","evidence","settlements","settlementLines","payments","benefits","claims","scenarios"))assertEquals(rows(d,key).size(),index(d,key).size());
        for(var s:stores.values())assertTrue(people.containsKey(s.get("ownerPersonaId")));
        for(var o:offerings.values()){assertTrue(stores.containsKey(o.get("storeId")));assertEquals(n(o,"unitPriceWon")*n(o,"targetUnits"),n(o,"targetWon"));}
        for(var key:List.of("subscriptions","holdings"))for(var r:rows(d,key)){assertTrue(people.containsKey(r.get("personaId")));assertTrue(offerings.containsKey(r.get("offeringId")));assertEquals(true,r.get("synthetic"));}
        for(var l:rows(d,"settlementLines")){assertTrue(holds.containsKey(l.get("holdingId")));assertTrue(settlements.containsKey(l.get("settlementId")));assertEquals(holds.get(l.get("holdingId")).get("personaId"),l.get("personaId"));}
        for(var c:rows(d,"claims")){assertTrue(benefits.containsKey(c.get("benefitId")));assertTrue(people.containsKey(c.get("personaId")));assertTrue(c.get("code").toString().startsWith("DEMO-NOT-VALID-"));}
        for(var h:holds.values()){assertEquals(0,n(h,"chainUnits"));assertEquals("NOT_SUBMITTED",h.get("chainStatus"));}
        var text=new ObjectMapper().writeValueAsString(d);assertFalse(text.contains("attestationUid"));assertFalse(text.contains("txHash"));assertFalse(text.matches(".*0x[0-9a-fA-F]{40,}.*"));
    }
    @Test void allMonthlyCsvAndExceptionCasesAreReconciledByRealCoreLogic() throws Exception {
        var d=data();assertEquals(48,rows(d,"revenues").size());assertEquals(3,rows(d,"exceptionSources").size());
        var sources=new ArrayList<>(rows(d,"revenues"));sources.addAll(rows(d,"exceptionSources"));
        for(var r:sources){
            byte[] bytes;try(var s=getClass().getResourceAsStream("/demo/"+r.get("sourceCsv"))){assertNotNull(s);bytes=s.readAllBytes();}
            assertEquals(r.get("sha256"),HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)));
            var report=CsvReconciliation.reconcile(new String(bytes,StandardCharsets.UTF_8),(String)r.get("period"));
            assertEquals(r.get("netSalesWon"),report.netWon(),r.get("id").toString());assertEquals(r.get("reconciled"),report.ready(),r.get("id").toString());
        }
        for(var s:rows(d,"stores"))assertEquals(6,rows(d,"revenues").stream().filter(r->r.get("storeId").equals(s.get("id"))).count());
    }
    @Test void subscriptionStatesMatchProgressAllocationRefundsAndHoldings() throws Exception {
        var d=data();
        for(var o:rows(d,"offerings")){
            var subs=rows(d,"subscriptions").stream().filter(s->s.get("offeringId").equals(o.get("id"))).toList();
            long progress=0;for(var s:subs){long units=n(s,"units"),allocated=n(s,"allocatedUnits"),refunded=n(s,"refundedUnits");
                switch((String)s.get("status")){case "ACCEPTED"->{assertEquals(0,allocated);assertEquals(0,refunded);progress+=units;}case "ALLOCATED"->{assertEquals(units,allocated+refunded);progress+=allocated;}case "CANCELLED","REFUNDED"->{assertEquals(units,refunded);assertEquals(0,allocated);}default->fail("Unknown subscription state");}
                long held=rows(d,"holdings").stream().filter(h->h.get("offeringId").equals(o.get("id"))&&h.get("personaId").equals(s.get("personaId"))).mapToLong(h->n(h,"units")).sum();assertEquals(allocated,held);
            }
            assertEquals(progress,n(o,"acceptedUnits"));assertTrue(progress<=n(o,"targetUnits"));
            if(List.of("FUNDED","MATURED").contains(o.get("status")))assertEquals(n(o,"targetUnits"),progress);
        }
    }
    @Test void settlementsRespectContractRangeTotalsRoundingAndPaymentHistory() throws Exception {
        var d=data();var offerings=index(d,"offerings");var holdingIndex=index(d,"holdings");
        for(var s:rows(d,"settlements")){
            var o=offerings.get(s.get("offeringId"));var start=YearMonth.from(LocalDate.parse((String)o.get("startsOn")));var period=YearMonth.parse((String)s.get("period"));assertFalse(period.isBefore(start));assertTrue(period.isBefore(start.plusMonths(n(o,"months"))));
            assertEquals(SettlementMath.pool(n(s,"netSalesWon"),(int)n(o,"rateBps")),n(s,"poolWon"));assertEquals(SettlementMath.cash(n(s,"netSalesWon")),n(s,"cashAvailableWon"));
            var lines=rows(d,"settlementLines").stream().filter(l->l.get("settlementId").equals(s.get("id"))).toList();assertEquals(n(s,"poolWon"),lines.stream().mapToLong(l->n(l,"amountWon")).sum());
            var expected=SettlementMath.distribute(n(s,"poolWon"),lines.stream().map(l->new SettlementMath.Position((String)l.get("holdingId"),n(holdingIndex.get(l.get("holdingId")),"units"))).toList());
            for(var l:lines){
                assertEquals(expected.stream().filter(e->e.id().equals(l.get("holdingId"))).findFirst().orElseThrow().amount(),n(l,"amountWon"));
                var attempts=rows(d,"payments").stream().filter(p->p.get("lineId").equals(l.get("id"))).toList();assertEquals(n(l,"paidWon"),attempts.stream().mapToLong(p->n(p,"paidWon")).sum());
                long balance=n(l,"amountWon")-n(l,"priorPaidWon")-n(l,"paidWon");assertEquals(Math.max(0,balance),n(l,"unpaidWon"));assertEquals(Math.max(0,-balance),n(l,"overpaidWon"));
                var prior=rows(d,"settlementLines").stream().filter(old->old.get("holdingId").equals(l.get("holdingId"))&&old.get("settlementId").equals(s.get("previousId"))).findFirst();
                assertEquals(prior.map(p->n(p,"priorPaidWon")+n(p,"paidWon")).orElse(0L),n(l,"priorPaidWon"));assertEquals(n(l,"amountWon")-prior.map(p->n(p,"amountWon")).orElse(0L),n(l,"deltaWon"));
            }
            assertTrue(lines.stream().mapToLong(l->n(l,"paidWon")).sum()<=n(s,"cashAvailableWon"));
            assertEquals("NOT_SUBMITTED",s.get("chainStatus"));assertNotEquals(s.get("calculatedBy"),s.get("approvedBy"));
        }
        for(var p:rows(d,"payments")){assertTrue(n(p,"paidWon")<=n(p,"requestedWon"));if("FAILED_SAMPLE".equals(p.get("outcome")))assertEquals(0,n(p,"paidWon"));}
        assertTrue(rows(d,"settlementLines").stream().anyMatch(l->n(l,"overpaidWon")>0));assertTrue(rows(d,"settlementLines").stream().anyMatch(l->n(l,"unpaidWon")>0));
    }
    @Test void benefitStatesCoverEligibilityClaimUsageExpiryAndCapacity() throws Exception {
        var d=data();var states=rows(d,"benefitStates");
        assertEquals(Set.of("AVAILABLE_SAMPLE","LOCKED_SAMPLE","CLAIMED_SAMPLE","USED_SAMPLE","EXPIRED_SAMPLE","UPCOMING_SAMPLE","SOLD_OUT_SAMPLE"),states.stream().map(s->s.get("status").toString()).collect(Collectors.toSet()));
        for(var b:rows(d,"benefits"))assertTrue(rows(d,"claims").stream().filter(c->c.get("benefitId").equals(b.get("id"))).count()<=n(b,"maxClaims"));
        for(var state:states){long held=rows(d,"holdings").stream().filter(h->h.get("personaId").equals(state.get("personaId"))&&h.get("offeringId").equals(index(d,"benefits").get(state.get("benefitId")).get("offeringId"))).mapToLong(h->n(h,"units")).sum();assertEquals(held,n(state,"heldUnits"));}
    }
}
