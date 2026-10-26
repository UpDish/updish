package io.updish.core.business;

import io.updish.core.auth.WalletPrincipal;
import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@org.springframework.core.annotation.Order(30)
public class MarketService implements org.springframework.boot.ApplicationRunner {
    private final JdbcTemplate db;private final WorkbenchService work;private final UxDemoDataService fixture;
    private static final UUID CATALOG_RUN=UUID.nameUUIDFromBytes("updish-market-v1".getBytes(java.nio.charset.StandardCharsets.UTF_8));
    public MarketService(JdbcTemplate db,WorkbenchService work,UxDemoDataService fixture){this.db=db;this.work=work;this.fixture=fixture;}
    @Override @Transactional public void run(org.springframework.boot.ApplicationArguments args){initialize(fixture.read());}
    @SuppressWarnings("unchecked") static List<Map<String,Object>> list(Map<String,Object> d,String key){return (List<Map<String,Object>>)d.get(key);}
    private void initialize(Map<String,Object> d){
        // Serialize lazy creation, including parallel first requests. Never move demo_state or seed balances.
        db.queryForObject("SELECT dataset_id FROM ux_demo_dataset WHERE dataset_id=? FOR UPDATE",String.class,UxDemoDataService.DATASET_ID);
        db.update("INSERT INTO demo_run(id,label) VALUES (?,?) ON CONFLICT DO NOTHING",CATALOG_RUN,"가게 목록 · 추가 모의 청약");
        var current=work.offering();
        for(var t:list(d,"offerings")){
            if(!"OPEN".equals(t.get("status"))||"store-seongsu".equals(t.get("storeId")))continue;
            if(db.queryForObject("SELECT count(*) FROM market_offering WHERE store_id=?",Integer.class,t.get("storeId"))>0)continue;
            var id=UUID.randomUUID();var store=list(d,"stores").stream().filter(s->s.get("id").equals(t.get("storeId"))).findFirst().orElseThrow();
            db.update("INSERT INTO offering(id,run_id,store_name,owner_address,title,target_units,unit_price,rate_bps,months,status,token_id,starts_on) VALUES (?,?,?,?,?,?,?,?,?,'OPEN',?,?::date)",id,CATALOG_RUN,store.get("name"),current.get("owner_address"),t.get("title"),t.get("targetUnits"),Long.parseLong(t.get("unitPriceWon").toString()),t.get("rateBps"),t.get("months"),new BigDecimal(new BigInteger(id.toString().replace("-",""),16)),t.get("startsOn"));
            db.update("INSERT INTO market_offering(store_id,offering_id) VALUES (?,?)",t.get("storeId"),id);
        }
    }
    private Map<String,Object> live(Map<String,Object> terms){
        Map<String,Object> o;
        if("store-seongsu".equals(terms.get("storeId"))){
            // A read-only catalog must not call runId(), which acquires FOR SHARE for business writes.
            o=work.one("SELECT * FROM offering WHERE run_id=(SELECT run_id FROM demo_state WHERE singleton=true) ORDER BY created_at DESC LIMIT 1");
        }else{
            var ids=work.rows("SELECT offering_id FROM market_offering WHERE store_id=?",terms.get("storeId"));if(ids.isEmpty())return null;
            o=work.one("SELECT * FROM offering WHERE id=?",UUID.fromString(ids.getFirst().get("offering_id").toString()));
        }
        o.put("accepted_units",db.queryForObject("SELECT coalesce(sum(units-refunded_units),0) FROM subscription WHERE offering_id=? AND status IN ('ACCEPTED','ALLOCATED')",Long.class,UUID.fromString(o.get("id").toString())));
        o.put("mode","SIMULATION");o.put("principal_redemption","만기 원금 별도 상환 의무 없음");o.put("risk","매출 감소·지급 실패로 손실 가능. 실제 자금 이동 없음.");return o;
    }
    @Transactional(readOnly=true) public Map<String,Object> catalog(WalletPrincipal actor){
        work.role(actor);var d=fixture.read();var listings=new ArrayList<Map<String,Object>>();
        for(var store:list(d,"stores")){
            var t=list(d,"offerings").stream().filter(o->o.get("storeId").equals(store.get("id"))).findFirst().orElseThrow();
            var row=new LinkedHashMap<String,Object>();row.put("store",store);row.put("terms",t);row.put("offering",live(t));
            row.put("revenues",list(d,"revenues").stream().filter(r->r.get("storeId").equals(store.get("id"))).toList());
            row.put("source",row.get("offering")==null?"SAMPLE_HISTORY":"SIMULATION_LEDGER");listings.add(row);
        }
        return Map.of("listings",listings,"mode","SIMULATION","asOf",d.get("asOf"));
    }
    @Transactional(readOnly=true) public Map<String,Object> portfolio(WalletPrincipal actor){
        work.role(actor);var a=actor.address();
        return Map.of("subscriptions",work.rows("SELECT s.*,o.store_name,o.unit_price FROM subscription s JOIN offering o ON o.id=s.offering_id WHERE s.address=? ORDER BY s.created_at DESC,s.id",a),
            "holdings",work.rows("SELECT h.*,o.store_name,o.unit_price,o.status AS offering_status FROM holding h JOIN offering o ON o.id=h.offering_id WHERE h.address=? ORDER BY o.store_name,h.id",a),
            "settlements",work.rows("SELECT s.id,s.offering_id,o.store_name,s.period,s.version,s.status,l.id AS line_id,l.amount_won,l.paid_won,l.prior_paid_won,l.delta_won FROM settlement s JOIN offering o ON o.id=s.offering_id JOIN settlement_line l ON l.settlement_id=s.id WHERE l.address=? ORDER BY s.period DESC,s.version DESC",a),"mode","SIMULATION");
    }
}
