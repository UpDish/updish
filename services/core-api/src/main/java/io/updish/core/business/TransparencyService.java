package io.updish.core.business;

import io.updish.core.auth.WalletPrincipal;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TransparencyService {
    private final WorkbenchService work;private final UxDemoDataService fixture;
    public TransparencyService(WorkbenchService work,UxDemoDataService fixture){this.work=work;this.fixture=fixture;}
    @SuppressWarnings("unchecked") private static List<Map<String,Object>> list(Map<String,Object> d,String key){return (List<Map<String,Object>>)d.get(key);}
    @SuppressWarnings("unchecked") static Map<String,Object> publicReport(Map<?,?> report){
        var issues=(List<Map<String,Object>>)report.get("issues");var missing=new HashSet<String>();var counts=new TreeMap<String,Integer>();var blocked=new HashSet<String>();
        for(var i:issues){var code=i.get("code").toString();counts.merge(code,1,Integer::sum);if(Boolean.TRUE.equals(i.get("blocking")))blocked.add(code);if("MISSING_SOURCE".equals(code)&&Set.of("POS","PG","BANK").contains(i.get("eventId")))missing.add(i.get("eventId").toString());}
        var result=new LinkedHashMap<String,Object>();for(var key:List.of("grossWon","discountWon","refundWon","netWon","rowCount","acceptedCount","ready"))result.put(key,report.get(key));
        var net=new BigInteger(report.get("netWon").toString());
        for(var pair:List.of(new String[]{"PG","pgWon","pgGapWon"},new String[]{"BANK","bankWon","bankGapWon"})){var value=missing.contains(pair[0])?null:report.get(pair[1]);result.put(pair[1],value);result.put(pair[2],value==null?null:new BigInteger(value.toString()).subtract(net).toString());}
        result.put("duplicateIgnored",counts.getOrDefault("DUPLICATE_IGNORED",0));result.put("blockingCount",issues.stream().filter(i->Boolean.TRUE.equals(i.get("blocking"))).count());
        result.put("issueCounts",counts.entrySet().stream().map(e->Map.of("code",e.getKey(),"count",e.getValue(),"blocking",blocked.contains(e.getKey()))).toList());
        result.put("sources",List.of("POS","PG","BANK").stream().map(name->Map.of("name",name,"available",!missing.contains(name))).toList());return result;
    }
    private Map<String,Object> sample(Map<String,Object> source,boolean exception){
        var path="/demo/"+source.get("sourceCsv");String csv;
        try(var stream=getClass().getResourceAsStream(path)){if(stream==null)throw new IllegalStateException("Missing canonical transparency sample");csv=new String(stream.readAllBytes(),StandardCharsets.UTF_8);}catch(java.io.IOException ex){throw new IllegalStateException(ex);}
        var report=work.decode(work.encode(CsvReconciliation.reconcile(csv,source.get("period").toString())));var item=base(source.get("id").toString(),source.get("period").toString(),"SYNTHETIC_CSV",report);
        var id=source.get("id").toString();item.put("label",exception?(id.contains("missing-bank")?"은행 입금 자료 누락":id.contains("pg-mismatch")?"POS·PG 불일치":"추가 환불 정정"):source.get("period")+" 결제·정산 대조");item.put("sourceHash",source.get("sha256"));return item;
    }
    private Map<String,Object> base(String id,String period,String basis,Map<?,?> report){
        var row=new LinkedHashMap<String,Object>();row.put("id",id);row.put("period",period);row.put("basis",basis);row.put("status",Boolean.TRUE.equals(report.get("ready"))?"RECONCILED":"BLOCKED");row.put("reconciliation",publicReport(report));row.put("version",null);row.put("settlementId",null);row.put("digest",null);row.put("chainStatus","NOT_SUBMITTED");row.put("chainTxHash",null);return row;
    }
    @Transactional(readOnly=true,isolation=org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
    public Map<String,Object> read(WalletPrincipal actor,String storeId){
        work.role(actor);var d=fixture.read();var store=list(d,"stores").stream().filter(s->storeId.equals(s.get("id"))).findFirst().orElseThrow(BusinessFailure::missing);
        var ids="store-seongsu".equals(storeId)?work.rows("SELECT id AS offering_id FROM offering WHERE run_id=(SELECT run_id FROM demo_state WHERE singleton=true) ORDER BY created_at DESC LIMIT 1"):work.rows("SELECT offering_id FROM market_offering WHERE store_id=?",storeId);
        var approved=new ArrayList<Map<String,Object>>();var submissions=new ArrayList<Map<String,Object>>();
        if(!ids.isEmpty()){
            var offering=UUID.fromString(ids.getFirst().get("offering_id").toString());
            for(var s:work.rows("SELECT DISTINCT ON (s.period) s.id,s.period,s.version,s.digest,e.report,e.source_hash FROM settlement s JOIN evidence e ON e.id=s.evidence_id WHERE s.offering_id=? AND s.status='APPROVED' ORDER BY s.period DESC,s.version DESC",offering)){
                var item=base(s.get("id").toString(),s.get("period").toString(),"APPROVED_LEDGER",(Map<?,?>)s.get("report"));item.put("label",s.get("period")+" 승인 정산");item.put("status","APPROVED");item.put("version",s.get("version"));item.put("settlementId",s.get("id"));item.put("digest",s.get("digest"));item.put("sourceHash",s.get("source_hash"));
                var jobs=work.rows("SELECT status,tx_hash FROM chain_job WHERE kind='SETTLEMENT' AND reference_id=?",UUID.fromString(s.get("id").toString()));if(!jobs.isEmpty()){item.put("chainStatus",jobs.getFirst().get("status"));item.put("chainTxHash",jobs.getFirst().get("tx_hash"));}approved.add(item);
            }
            // Unapproved amounts, filenames, transaction IDs, wallets and review text remain private.
            for(var e:work.rows("SELECT DISTINCT ON (period) period,status,report FROM evidence WHERE offering_id=? ORDER BY period DESC,created_at DESC,id DESC",offering)){
                var report=publicReport((Map<?,?>)e.get("report"));submissions.add(Map.of("period",e.get("period"),"status",e.get("status"),"blockingCount",report.get("blockingCount"),"issueCounts",report.get("issueCounts")));
            }
        }
        var samples=new ArrayList<Map<String,Object>>();var revenues=list(d,"revenues").stream().filter(s->storeId.equals(s.get("storeId"))).sorted(Comparator.comparing(s->s.get("period").toString(),Comparator.reverseOrder())).toList();
        if(!revenues.isEmpty())samples.add(sample(revenues.getFirst(),false));
        for(var source:list(d,"exceptionSources"))if(storeId.equals(source.get("storeId")))samples.add(sample(source,true));
        var result=new LinkedHashMap<String,Object>();result.put("store",Map.of("id",store.get("id"),"name",store.get("name"),"district",store.get("district"),"category",store.get("category")));result.put("approved",approved);result.put("submissions",submissions);result.put("samples",samples);result.put("mode","SIMULATION");result.put("asOf",d.get("asOf"));return result;
    }
}
