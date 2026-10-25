package io.updish.core.business;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.*;

/** Deliberately narrow CSV schema: ASCII IDs, unquoted fields, integer won, ISO dates. */
public final class CsvReconciliation {
    public static final String HEADER="source,event_id,kind,related_id,amount_won,date";
    public record Event(String source,String eventId,String kind,String relatedId,long amount,String date) {}
    public record Issue(String code,String eventId,String message,boolean blocking) {}
    public record Report(String grossWon,String discountWon,String refundWon,String netWon,
            String pgWon,String bankWon,int rowCount,int acceptedCount,List<Issue> issues,boolean ready) {}
    private CsvReconciliation() {}
    public static Report reconcile(String csv,String period) {
        YearMonth month;
        try { month=YearMonth.parse(period); } catch (RuntimeException e) { throw BusinessFailure.invalid("정산 월은 YYYY-MM 형식입니다."); }
        if (csv==null || csv.length()>1_000_000 || csv.indexOf('\0')>=0) throw BusinessFailure.invalid("CSV는 1MB 이하로 제출해 주세요.");
        var lines=csv.replace("\r\n","\n").strip().replaceFirst("^\uFEFF","").split("\n",-1);
        if (lines.length<2 || lines.length>1001 || !lines[0].equals(HEADER)) throw BusinessFailure.invalid("제공된 고정 CSV 양식과 최대 1,000행을 확인해 주세요.");
        var events=new LinkedHashMap<String,Event>(); var issues=new ArrayList<Issue>();
        for (int i=1;i<lines.length;i++) {
            var f=lines[i].split(",",-1);
            if (f.length!=6 || lines[i].contains("\"") || !f[1].matches("[A-Za-z0-9_-]{1,80}")
                    || !f[3].matches("[A-Za-z0-9_-]{0,80}") || !f[4].matches("[0-9]{1,12}")) throw BusinessFailure.invalid("CSV "+(i+1)+"행 형식을 확인해 주세요. 쉼표/줄바꿈이 포함된 필드는 지원하지 않습니다.");
            if (!Set.of("POS","PG","BANK").contains(f[0]) || !Set.of("SALE","DISCOUNT","REFUND","CAPTURE","DEPOSIT").contains(f[2])) throw BusinessFailure.invalid("지원하지 않는 출처 또는 거래 유형입니다.");
            if (!(f[0].equals("POS") && Set.of("SALE","DISCOUNT","REFUND").contains(f[2])
                    || f[0].equals("PG") && f[2].equals("CAPTURE") || f[0].equals("BANK") && f[2].equals("DEPOSIT"))) throw BusinessFailure.invalid("거래 유형과 출처가 일치하지 않습니다.");
            try { if (!YearMonth.from(LocalDate.parse(f[5])).equals(month)) throw BusinessFailure.invalid("다른 기간의 거래가 포함됐습니다."); }
            catch (java.time.format.DateTimeParseException e) { throw BusinessFailure.invalid("날짜는 YYYY-MM-DD 형식입니다."); }
            long amount=Long.parseLong(f[4]); if(amount<=0) throw BusinessFailure.invalid("거래 금액은 양의 정수 원입니다.");
            var event=new Event(f[0],f[1],f[2],f[3],amount,f[5]);
            var old=events.putIfAbsent(f[0]+":"+f[1],event);
            if(old!=null) issues.add(new Issue(old.equals(event)?"DUPLICATE_IGNORED":"DUPLICATE_CONFLICT",f[1],
                    old.equals(event)?"동일 외부 ID의 동일 거래는 한 번만 반영했습니다.":"동일 외부 ID의 내용이 다릅니다.",!old.equals(event)));
        }
        var sales=new HashMap<String,Long>(); var adjustments=new HashMap<String,Long>(); var captures=new HashMap<String,Long>();
        long gross=0,discount=0,refund=0,pg=0,bank=0;
        for(var e:events.values()) if(e.kind().equals("SALE")) {sales.put(e.eventId(),e.amount());gross=Math.addExact(gross,e.amount());}
        for(var e:events.values()) {
            switch(e.kind()) {
                case "DISCOUNT","REFUND" -> {
                    if(!sales.containsKey(e.relatedId())) issues.add(new Issue("MISSING_SALE",e.eventId(),"할인/환불의 원거래 ID가 없습니다.",true));
                    adjustments.merge(e.relatedId(),e.amount(),Math::addExact);
                    if(e.kind().equals("DISCOUNT")) discount=Math.addExact(discount,e.amount()); else refund=Math.addExact(refund,e.amount());
                }
                case "CAPTURE" -> { captures.merge(e.relatedId(),e.amount(),Math::addExact); pg=Math.addExact(pg,e.amount()); }
                case "DEPOSIT" -> bank=Math.addExact(bank,e.amount());
                default -> {}
            }
        }
        for(var id:adjustments.keySet()) if(adjustments.get(id)>sales.getOrDefault(id,0L)) issues.add(new Issue("EXCESS_ADJUSTMENT",id,"할인·환불 합계가 원거래를 초과합니다.",true));
        for(var sale:sales.entrySet()) if(!Objects.equals(captures.get(sale.getKey()),sale.getValue()-adjustments.getOrDefault(sale.getKey(),0L))) issues.add(new Issue("PG_MISMATCH",sale.getKey(),"PG 완료 금액과 원거래 순액이 다르거나 자료가 누락됐습니다.",true));
        for(var id:captures.keySet()) if(!sales.containsKey(id)) issues.add(new Issue("UNLINKED_PG",id,"연결되지 않은 PG 원거래 ID입니다.",true));
        for(var source:List.of("POS","PG","BANK")) if(events.values().stream().noneMatch(e->e.source().equals(source))) issues.add(new Issue("MISSING_SOURCE",source,"필수 출처 자료가 없습니다. 0원으로 대체하지 않습니다.",true));
        long net=gross-discount-refund;
        if(net<0 || bank!=net) issues.add(new Issue("BANK_MISMATCH","BANK","은행 입금 합계와 순매출이 다릅니다. 계약에 없는 수수료를 자동 차감하지 않습니다.",true));
        return new Report(""+gross,""+discount,""+refund,""+net,""+pg,""+bank,lines.length-1,events.size(),List.copyOf(issues),issues.stream().noneMatch(Issue::blocking));
    }
}
