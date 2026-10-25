package io.updish.core.business;
import static org.junit.jupiter.api.Assertions.*;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
class CsvReconciliationTests {
    static String fixture(String name) throws Exception {try(var stream=CsvReconciliationTests.class.getResourceAsStream("/"+name+".csv")) {return new String(stream.readAllBytes(),StandardCharsets.UTF_8);}}
    @Test void normalDuplicateAndPartialRefundAreAppliedOnce() throws Exception {var r=CsvReconciliation.reconcile(fixture("normal"),"2026-10");assertTrue(r.ready());assertEquals("31000000",r.grossWon());assertEquals("600000",r.discountWon());assertEquals("400000",r.refundWon());assertEquals("30000000",r.netWon());assertEquals(2,r.issues().size());}
    @Test void missingBankIsBlockedRatherThanZeroSales() throws Exception {var r=CsvReconciliation.reconcile(fixture("missing-bank"),"2026-10");assertFalse(r.ready());assertEquals("30000000",r.netWon());assertTrue(r.issues().stream().anyMatch(i->i.code().equals("MISSING_SOURCE")));}
    @Test void conflictsAndUnlinkedRefundsBlockClosing() throws Exception {var s=fixture("normal")+"POS,sale01,SALE,,1,2026-10-01\nPOS,unknown_refund,REFUND,missing,1,2026-10-01\n";var r=CsvReconciliation.reconcile(s,"2026-10");assertFalse(r.ready());assertTrue(r.issues().stream().anyMatch(i->i.code().equals("DUPLICATE_CONFLICT")));assertTrue(r.issues().stream().anyMatch(i->i.code().equals("MISSING_SALE")));}
    @Test void malformedPeriodNumbersAndSchemaAreRejected() throws Exception {assertThrows(BusinessFailure.class,()->CsvReconciliation.reconcile(fixture("normal"),"2026-11"));assertThrows(BusinessFailure.class,()->CsvReconciliation.reconcile(fixture("normal").replace("18000000","-1"),"2026-10"));assertThrows(BusinessFailure.class,()->CsvReconciliation.reconcile("wrong\nheader","2026-10"));}
}
