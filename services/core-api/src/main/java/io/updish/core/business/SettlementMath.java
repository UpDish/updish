package io.updish.core.business;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.math.RoundingMode;
import java.util.*;

public final class SettlementMath {
    public record Position(String id, long units) {}
    public record Share(String id, long amount) {}
    private record Fraction(String id, long floor, BigInteger remainder) {}
    private SettlementMath() {}
    public static long pool(long netSales, int bps) {
        if (netSales < 0 || bps < 0 || bps > 10000) throw BusinessFailure.invalid("매출과 분배율 범위를 확인해 주세요.");
        return BigDecimal.valueOf(netSales).multiply(BigDecimal.valueOf(bps))
                .divide(BigDecimal.valueOf(10000),0,RoundingMode.DOWN).longValueExact();
    }
    public static List<Share> distribute(long pool, List<Position> positions) {
        if (pool < 0 || positions.isEmpty() || positions.stream().anyMatch(p->p.units()<=0)
                || positions.stream().map(Position::id).distinct().count()!=positions.size()) throw BusinessFailure.invalid("보유 기준을 확인해 주세요.");
        var denominator=positions.stream().map(p->BigInteger.valueOf(p.units())).reduce(BigInteger.ZERO,BigInteger::add);
        var fractions=positions.stream().map(p->{
            var values=BigInteger.valueOf(pool).multiply(BigInteger.valueOf(p.units())).divideAndRemainder(denominator);
            return new Fraction(p.id(),values[0].longValueExact(),values[1]);
        }).sorted(Comparator.comparing(Fraction::remainder).reversed().thenComparing(Fraction::id)).toList();
        long remaining=pool-fractions.stream().mapToLong(Fraction::floor).sum();
        var result=new ArrayList<Share>();
        for (int i=0;i<fractions.size();i++) result.add(new Share(fractions.get(i).id(),fractions.get(i).floor()+(i<remaining?1:0)));
        return result.stream().sorted(Comparator.comparing(Share::id)).toList();
    }
    public static long cash(long netSales) {
        return Math.max(0,BigDecimal.valueOf(netSales).multiply(new BigDecimal("0.45"))
                .subtract(BigDecimal.valueOf(10_500_000)).setScale(0,RoundingMode.DOWN).longValueExact());
    }
}
