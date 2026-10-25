package io.updish.core.business;
import static org.junit.jupiter.api.Assertions.*;
import java.util.List;
import org.junit.jupiter.api.Test;
class SettlementMathTests {
    @Test void agreedExampleAndPoolMatch() {
        var pool=SettlementMath.pool(30_000_000,300);assertEquals(900_000,pool);
        var shares=SettlementMath.distribute(pool,List.of(new SettlementMath.Position("investor",100),new SettlementMath.Position("background",3500)));
        assertEquals(25_000,shares.stream().filter(s->s.id().equals("investor")).findFirst().orElseThrow().amount());
        assertEquals(pool,shares.stream().mapToLong(SettlementMath.Share::amount).sum());
    }
    @Test void residualWonIsDeterministicAndNoMoneyLost() {
        var shares=SettlementMath.distribute(2,List.of(new SettlementMath.Position("c",1),new SettlementMath.Position("b",1),new SettlementMath.Position("a",1)));
        assertEquals(List.of(new SettlementMath.Share("a",1),new SettlementMath.Share("b",1),new SettlementMath.Share("c",0)),shares);
    }
    @Test void cashShortageDoesNotReduceObligation() {assertEquals(720000,SettlementMath.pool(24000000,300));assertEquals(300000,SettlementMath.cash(24000000));}
    @Test void rejectsInvalidHoldingsAndUsesLargeIntegerArithmetic() {
        assertThrows(BusinessFailure.class,()->SettlementMath.distribute(10,List.of(new SettlementMath.Position("a",0))));
        assertThrows(BusinessFailure.class,()->SettlementMath.distribute(10,List.of(new SettlementMath.Position("a",1),new SettlementMath.Position("a",2))));
        assertEquals(Long.MAX_VALUE,SettlementMath.distribute(Long.MAX_VALUE,List.of(new SettlementMath.Position("a",Long.MAX_VALUE))).getFirst().amount());
    }
}
