package io.updish.core.business;

import io.updish.core.auth.WalletPrincipal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

@Service
public class UxDemoDataService implements ApplicationRunner {
    public static final String DATASET_ID="updish-ux-v1";
    private final JdbcTemplate db;private final ObjectMapper json;private final WorkbenchService work;
    public UxDemoDataService(JdbcTemplate db,ObjectMapper json,WorkbenchService work){this.db=db;this.json=json;this.work=work;}
    @Override public void run(ApplicationArguments arguments) throws Exception {seed();}
    @Transactional public void seed() throws Exception {
        String raw,expected;try(var data=getClass().getResourceAsStream("/demo/ux-dataset.json");var hash=getClass().getResourceAsStream("/demo/ux-dataset.sha256")){
            raw=new String(data.readAllBytes(),StandardCharsets.UTF_8);expected=new String(hash.readAllBytes(),StandardCharsets.UTF_8).strip();
        }
        var actual=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8)));
        if(!actual.equals(expected))throw new IllegalStateException("UX fixture source hash mismatch");
        var data=json.readValue(raw,Map.class);
        if(!DATASET_ID.equals(data.get("datasetId"))||!"SIMULATION".equals(data.get("mode"))||!"SYNTHETIC_UX_FIXTURE".equals(data.get("source")))throw new IllegalStateException("Invalid UX fixture identity");
        db.update("INSERT INTO ux_demo_dataset(dataset_id,version,source_sha256,payload) VALUES (?,?,?,?::jsonb) ON CONFLICT(dataset_id) DO NOTHING",DATASET_ID,((Number)data.get("version")).intValue(),actual,raw);
        if(!actual.equals(db.queryForObject("SELECT source_sha256 FROM ux_demo_dataset WHERE dataset_id=?",String.class,DATASET_ID)))throw new IllegalStateException("Existing UX fixture differs. Publish a new dataset version instead of replacing it.");
    }
    @Transactional(readOnly=true) public Map<String,Object> dataset(WalletPrincipal actor){work.requireOperator(actor);return read();}
    @SuppressWarnings("unchecked") private Map<String,Object> read(){
        var row=db.queryForMap("SELECT source_sha256,payload::text AS payload FROM ux_demo_dataset WHERE dataset_id=?",DATASET_ID);
        var result=new LinkedHashMap<String,Object>(json.readValue((String)row.get("payload"),Map.class));result.put("sourceSha256",row.get("source_sha256"));return result;
    }
    @SuppressWarnings("unchecked") private static List<Map<String,Object>> list(Map<String,Object> d,String key){return (List<Map<String,Object>>)d.get(key);}
    private static Set<Object> ids(List<Map<String,Object>> rows){return new HashSet<>(rows.stream().map(r->r.get("id")).toList());}
    private static List<Map<String,Object>> own(Map<String,Object> d,String key,String id){return list(d,key).stream().filter(r->id.equals(r.get("personaId"))).toList();}
    @Transactional(readOnly=true) public Map<String,Object> persona(WalletPrincipal actor,String personaId){
        // Choosing a fixture persona never changes the authenticated account or its role.
        work.requireOperator(actor);var d=read();
        var p=list(d,"personas").stream().filter(r->personaId.equals(r.get("id"))&&Boolean.TRUE.equals(r.get("selectable"))).findFirst().orElseThrow(BusinessFailure::missing);
        @SuppressWarnings("unchecked") var roles=(List<String>)p.get("roles");
        var managed=list(d,"stores").stream().filter(s->personaId.equals(s.get("ownerPersonaId"))).toList();var managedIds=ids(managed);
        var approved=list(d,"settlements").stream().filter(s->"APPROVED_SAMPLE".equals(s.get("status"))).toList();var approvedIds=ids(approved);
        var lines=own(d,"settlementLines",personaId).stream().filter(l->approvedIds.contains(l.get("settlementId"))).toList();
        var lineSettlementIds=new HashSet<>(lines.stream().map(l->l.get("settlementId")).toList());
        var result=new LinkedHashMap<String,Object>();for(var key:List.of("datasetId","version","asOf","mode","source","disclaimer","sourceSha256"))result.put(key,d.get(key));
        result.put("persona",p);result.put("market",Map.of("stores",d.get("stores"),"offerings",d.get("offerings"),"revenues",d.get("revenues")));
        result.put("portfolio",Map.of("subscriptions",own(d,"subscriptions",personaId),"holdings",own(d,"holdings",personaId),"settlements",approved.stream().filter(s->lineSettlementIds.contains(s.get("id"))).toList(),"lines",lines,"payments",own(d,"payments",personaId)));
        result.put("storeManagement",Map.of("stores",managed,"offerings",list(d,"offerings").stream().filter(e->managedIds.contains(e.get("storeId"))).toList(),"evidence",list(d,"evidence").stream().filter(e->managedIds.contains(e.get("storeId"))).toList(),"revenues",list(d,"revenues").stream().filter(e->managedIds.contains(e.get("storeId"))).toList(),"exceptionSources",list(d,"exceptionSources").stream().filter(e->managedIds.contains(e.get("storeId"))).toList(),"settlements",list(d,"settlements").stream().filter(e->managedIds.contains(e.get("storeId"))).toList(),"benefits",list(d,"benefits").stream().filter(e->managedIds.contains(e.get("storeId"))).toList()));
        result.put("customerBenefits",Map.of("definitions",roles.contains("CUSTOMER")?d.get("benefits"):List.of(),"states",own(d,"benefitStates",personaId),"claims",own(d,"claims",personaId)));
        result.put("reviewQueue",roles.contains("REVIEWER")||roles.contains("OPERATOR")?d.get("evidence"):List.of());
        result.put("operations",Map.of("settlements",roles.contains("OPERATOR")?d.get("settlements"):List.of(),"offerings",roles.contains("OPERATOR")?d.get("offerings"):List.of()));
        var sections=new LinkedHashSet<>(List.of("MARKET","INVESTMENTS"));
        for(var role:roles)switch(role){case "CUSTOMER"->sections.add("BENEFITS");case "MERCHANT"->sections.add("STORE_MANAGEMENT");case "REVIEWER"->sections.add("REVIEW");case "OPERATOR"->{sections.add("OPERATIONS");sections.add("REVIEW");}default->{}}
        result.put("availableSections",List.copyOf(sections));
        return result;
    }
}
