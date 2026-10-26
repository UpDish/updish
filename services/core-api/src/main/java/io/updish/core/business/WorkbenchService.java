package io.updish.core.business;

import io.updish.core.auth.WalletPrincipal;
import io.updish.core.chain.DojangCodec;
import io.updish.core.chain.GiwaService;
import java.math.BigInteger;
import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.YearMonth;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.web3j.crypto.Hash;
import tools.jackson.databind.ObjectMapper;

@Service
public class WorkbenchService implements ApplicationRunner {
    public static final String BACKGROUND="0x000000000000000000000000000000000000b001";
    private final JdbcTemplate db;
    private final ObjectMapper json;
    private final GiwaService giwa;
    private final String operator;
    public WorkbenchService(JdbcTemplate db,ObjectMapper json,GiwaService giwa,
            @Value("${updish.demo.operator-wallet}") String operator) {
        this.db=db;this.json=json;this.giwa=giwa;this.operator=DojangCodec.address(operator);
    }
    @Override public void run(ApplicationArguments args) { initialize(); }
    @Transactional public void initialize() {
        if(db.queryForObject("SELECT count(*) FROM offering WHERE run_id=?",Long.class,runId())==0) createOffering(runId());
        db.update("UPDATE wallet_user SET role='OPERATOR' WHERE address=?",operator);
    }
    public UUID runId() { return db.queryForObject("SELECT run_id FROM demo_state WHERE singleton=true FOR SHARE",UUID.class); }
    public Map<String,Object> offering() {
        var o=one("SELECT * FROM offering WHERE run_id=? ORDER BY created_at DESC LIMIT 1",runId());
        o.put("accepted_units",db.queryForObject("SELECT coalesce(sum(units-refunded_units),0) FROM subscription WHERE offering_id=? AND status IN ('ACCEPTED','ALLOCATED')",Long.class,uuid(o,"id")));
        o.put("mode","SIMULATION");o.put("principal_redemption","만기 원금 별도 상환 의무 없음");
        o.put("risk","매출 감소·현금 부족·지급 실패 시 손실이 생길 수 있습니다. 실제 자금은 받지 않습니다.");
        o.put("bojagi",Map.of("status","NOT_CONNECTED"));return o;
    }
    @Transactional(readOnly=true,isolation=org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
    public Map<String,Object> performance() {
        var id=db.queryForObject("SELECT id FROM offering WHERE run_id=(SELECT run_id FROM demo_state WHERE singleton=true) ORDER BY created_at DESC LIMIT 1",UUID.class);
        // Only the latest approved revision is public. Draft revisions and personal lines stay private.
        var points=rows("SELECT DISTINCT ON (period) period,version,net_sales AS net_sales_won,pool_won FROM settlement WHERE offering_id=? AND status='APPROVED' ORDER BY period,version DESC",id)
                .stream().map(row->Map.of("period",row.get("period"),"version",row.get("version"),"netSalesWon",row.get("net_sales_won"),"poolWon",row.get("pool_won"))).toList();
        return Map.of("offeringId",id.toString(),"points",points,"mode","SIMULATION");
    }
    public Map<String,Object> dashboard(WalletPrincipal actor) {
        var o=offering();var id=uuid(o,"id");
        var result=new LinkedHashMap<String,Object>();result.put("offering",o);result.put("user",Map.of("address",actor.address(),"role",role(actor)));
        result.put("subscriptions",rows("SELECT * FROM subscription WHERE offering_id=? AND address=? ORDER BY created_at",id,actor.address()));
        result.put("holdings",rows("SELECT * FROM holding WHERE offering_id=? AND address=?",id,actor.address()));
        result.put("settlements",rows("SELECT s.id,s.period,s.version,s.status,s.digest,s.pool_won,s.cash_available,s.created_at,l.id AS line_id,l.units,l.amount_won,l.paid_won,l.prior_paid_won,l.delta_won FROM settlement s JOIN settlement_line l ON l.settlement_id=s.id WHERE s.offering_id=? AND l.address=? ORDER BY s.period,s.version DESC",id,actor.address()));
        result.put("chain_jobs",rows("SELECT j.* FROM chain_job j JOIN allocation a ON a.id=j.reference_id JOIN holding h ON h.id=a.holding_id WHERE j.run_id=? AND h.address=? ORDER BY j.created_at",runId(),actor.address()));
        if(canManage(actor,o)) {
            result.put("evidence",rows("SELECT id,period,filename,report,source_hash,status,submitted_by,reviewed_by,review_reason,created_at FROM evidence WHERE offering_id=? ORDER BY created_at DESC",id));
        }
        if(isReviewer(actor)) {
            result.put("all_subscriptions",rows("SELECT * FROM subscription WHERE offering_id=? ORDER BY created_at",id));
            result.put("all_holdings",rows("SELECT * FROM holding WHERE offering_id=?",id));
            result.put("all_settlements",rows("SELECT id,period,version,status,pool_won,cash_available,digest,created_by,approved_by,reason FROM settlement WHERE offering_id=? ORDER BY created_at DESC",id));
            result.put("all_lines",rows("SELECT l.* FROM settlement_line l JOIN settlement s ON s.id=l.settlement_id WHERE s.offering_id=? ORDER BY s.created_at DESC",id));
            result.put("all_jobs",rows("SELECT * FROM chain_job WHERE run_id=? ORDER BY created_at",runId()));
            result.put("events",rows("SELECT * FROM business_event WHERE run_id=? ORDER BY created_at DESC LIMIT 30",runId()));
        }
        result.put("contracts",rows("SELECT units_address,registry_address,operator_address,checked_block FROM chain_config WHERE offering_id=?",id));
        return result;
    }
    @Transactional public Map<String,Object> member(WalletPrincipal actor,String address,String requestedRole,boolean owner) {
        requireOperator(actor);address=DojangCodec.address(address);
        if(!Set.of("INVESTOR","MERCHANT","REVIEWER").contains(requestedRole) || address.equals(operator) || address.equals(BACKGROUND)) throw BusinessFailure.invalid("이 주소 또는 역할은 변경할 수 없습니다.");
        db.update("INSERT INTO wallet_user(id,address,role) VALUES (?,?,?) ON CONFLICT(address) DO UPDATE SET role=excluded.role",UUID.randomUUID(),address,requestedRole);
        var o=offering();if(owner) {if(!requestedRole.equals("MERCHANT")) throw BusinessFailure.invalid("가게 담당자는 MERCHANT 역할이어야 합니다.");db.update("UPDATE offering SET owner_address=? WHERE id=?",address,uuid(o,"id"));}
        audit(actor,"ASSIGN_ROLE",uuid(o,"id"),requestedRole+":"+address);return Map.of("address",address,"role",requestedRole);
    }
    public String role(WalletPrincipal actor) { return db.queryForObject("SELECT role FROM wallet_user WHERE id=?",String.class,actor.id()); }
    public void requireOperator(WalletPrincipal actor) { if(actor==null || !"OPERATOR".equals(role(actor))) throw BusinessFailure.forbidden(); }
    public boolean isReviewer(WalletPrincipal actor) { return Set.of("OPERATOR","REVIEWER").contains(role(actor)); }
    public boolean canManage(WalletPrincipal actor,Map<String,Object> o) { return isReviewer(actor)||actor.address().equals(o.get("owner_address")); }
    public void requireManager(WalletPrincipal actor,Map<String,Object> o) { if(!canManage(actor,o)) throw BusinessFailure.forbidden(); }
    private Map<String,Object> lockedOffering(UUID id) {return one("SELECT * FROM offering WHERE id=? AND run_id=? FOR UPDATE",id,runId());}
    public void audit(WalletPrincipal actor,String action,UUID reference,String reason) {
        db.update("INSERT INTO business_event(id,run_id,actor,action,reference_id,reason) VALUES (?,?,?,?,?,?)",UUID.randomUUID(),runId(),actor.address(),action,reference,reason);
    }
    @Transactional public Map<String,Object> submitEvidence(WalletPrincipal actor,UUID offering,String period,String filename,String csv) {
        var o=lockedOffering(offering);if(!actor.address().equals(o.get("owner_address")) && !"OPERATOR".equals(role(actor))) throw BusinessFailure.forbidden();
        var report=CsvReconciliation.reconcile(csv,period);var hash=HexFormat.of().formatHex(Hash.sha256(csv.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        var old=rows("SELECT id FROM evidence WHERE offering_id=? AND source_hash=?",offering,hash);
        if(!old.isEmpty()) return evidence(actor,uuid(old.getFirst(),"id"));
        if(filename==null || !filename.matches("[\\p{L}\\p{N}_. -]{1,120}\\.csv")) throw BusinessFailure.invalid("CSV 파일 이름을 확인해 주세요.");
        var id=UUID.randomUUID();db.update("INSERT INTO evidence(id,offering_id,period,filename,csv_content,report,source_hash,status,submitted_by) VALUES (?,?,?,?,?,?::jsonb,?,?,?)",
                id,offering,period,filename,csv,encode(report),hash,report.ready()?"REVIEW":"BLOCKED",actor.address());
        audit(actor,"SUBMIT_EVIDENCE",id,"샘플 CSV 제출");return evidence(actor,id);
    }
    public Map<String,Object> evidence(WalletPrincipal actor,UUID id) {
        var e=one("SELECT * FROM evidence WHERE id=?",id);var o=one("SELECT * FROM offering WHERE id=?",uuid(e,"offering_id"));requireManager(actor,o);e.remove("csv_content");return e;
    }
    @Transactional public Map<String,Object> closeEvidence(WalletPrincipal actor,UUID id,String reason) {
        if(!isReviewer(actor)) throw BusinessFailure.forbidden();reason=reason(reason);
        var e=one("SELECT * FROM evidence WHERE id=? FOR UPDATE",id);
        if(e.get("submitted_by").equals(actor.address())) throw BusinessFailure.conflict("제출자와 마감 검토자는 다른 지갑이어야 합니다.");
        if(!e.get("status").equals("REVIEW")) throw BusinessFailure.conflict("대조가 완료된 검토 대기 자료만 마감할 수 있습니다.");
        db.update("UPDATE evidence SET status='CLOSED',reviewed_by=?,review_reason=?,closed_at=now() WHERE id=?",actor.address(),reason,id);
        audit(actor,"CLOSE_EVIDENCE",id,reason);return evidence(actor,id);
    }
    private GiwaService.Verification eligibility(WalletPrincipal actor,String address,String purpose) {
        var v=giwa.verify(address);
        db.update("INSERT INTO dojang_check(id,address,purpose,verified,uid,block_number) VALUES (?,?,?,?,?,?)",UUID.randomUUID(),address,purpose,v.verified(),v.attestationUid(),Long.parseLong(v.blockNumber()));
        if(!v.verified()) throw new BusinessFailure("DOJANG_REQUIRED",409,"유효한 TESTNET FAUCET Dojang이 필요합니다. 공식 Playground에서 발급해 주세요.");return v;
    }
    @Transactional public Map<String,Object> subscribe(WalletPrincipal actor,UUID offering,int units,UUID requestKey,boolean understood) {
        if(units<=0||units>3600||requestKey==null||!understood||actor.address().equals(BACKGROUND)) throw BusinessFailure.invalid("수량과 원금·손실·모의 청약 동의를 확인해 주세요.");
        var o=lockedOffering(offering);var old=rows("SELECT * FROM subscription WHERE offering_id=? AND address=? AND request_key=?",offering,actor.address(),requestKey);
        if(!old.isEmpty()) {if(number(old.getFirst(),"units")!=units) throw BusinessFailure.conflict("같은 요청 키의 수량이 다릅니다.");return old.getFirst();}
        if(!o.get("status").equals("OPEN")) throw BusinessFailure.conflict("모집 중인 상품만 청약할 수 있습니다.");
        long accepted=db.queryForObject("SELECT coalesce(sum(units),0) FROM subscription WHERE offering_id=? AND status='ACCEPTED'",Long.class,offering);
        if(accepted>=number(o,"target_units")) throw BusinessFailure.conflict("모집 수량 접수가 끝났습니다.");
        var v=eligibility(actor,actor.address(),"SUBSCRIBE");var id=UUID.randomUUID();
        db.update("INSERT INTO subscription(id,offering_id,address,units,status,request_key,dojang_uid,dojang_block) VALUES (?,?,?,?,'ACCEPTED',?,?,?)",id,offering,actor.address(),units,requestKey,v.attestationUid(),Long.parseLong(v.blockNumber()));
        audit(actor,"SUBSCRIBE",id,"모의 자금 확인, 보유 반영 전");return one("SELECT * FROM subscription WHERE id=?",id);
    }
    @Transactional public Map<String,Object> background(WalletPrincipal actor) {
        requireOperator(actor);var id=uuid(offering(),"id");var o=lockedOffering(id);
        if(!o.get("status").equals("OPEN")) throw BusinessFailure.conflict("모집 중에만 배경 시연 자료를 적재할 수 있습니다.");
        if(db.queryForObject("SELECT count(*) FROM subscription WHERE offering_id=? AND synthetic",Long.class,id)>0) return o;
        long used=db.queryForObject("SELECT coalesce(sum(units),0) FROM subscription WHERE offering_id=? AND status='ACCEPTED'",Long.class,id);
        if(used>100) throw BusinessFailure.conflict("3500단위 배경 자료를 더할 공간이 없습니다.");
        db.update("INSERT INTO subscription(id,offering_id,address,units,status,request_key,synthetic) VALUES (?,?,?,3500,'ACCEPTED',?,true)",UUID.randomUUID(),id,BACKGROUND,UUID.randomUUID());
        audit(actor,"LOAD_BACKGROUND",id,"명시적인 가상 배경 투자자 3500단위. Dojang/체인 발급을 주장하지 않음");return offering();
    }
    @Transactional public void cancel(WalletPrincipal actor,UUID id) {
        var sub=one("SELECT * FROM subscription WHERE id=?",id);lockedOffering(uuid(sub,"offering_id"));
        if(!actor.address().equals(sub.get("address"))) throw BusinessFailure.forbidden();
        if(!sub.get("status").equals("ACCEPTED")) throw BusinessFailure.conflict("배정 전 접수 상태에서만 취소할 수 있습니다.");
        db.update("UPDATE subscription SET status='CANCELLED',refunded_units=units WHERE id=?",id);audit(actor,"CANCEL",id,"모의 청약 취소 · 전량 모의 환불");
    }
    @Transactional public Map<String,Object> allocate(WalletPrincipal actor,UUID offering) {
        requireOperator(actor);var o=lockedOffering(offering);
        if(!o.get("status").equals("OPEN")) throw BusinessFailure.conflict("모집 중인 상품만 배정할 수 있습니다.");
        var subs=rows("SELECT * FROM subscription WHERE offering_id=? AND status='ACCEPTED' ORDER BY created_at,id",offering);
        if(subs.stream().mapToLong(s->number(s,"units")).sum()<number(o,"target_units")) throw BusinessFailure.conflict("전체 모집 수량이 접수돼야 배정할 수 있습니다.");
        long remaining=number(o,"target_units");
        for(var sub:subs) {
            long allotted=Math.min(number(sub,"units"),remaining);remaining-=allotted;
            if(allotted==0) {db.update("UPDATE subscription SET status='REFUNDED',refunded_units=units WHERE id=?",uuid(sub,"id"));continue;}
            boolean synthetic=(Boolean)sub.get("synthetic");if(!synthetic) eligibility(actor,(String)sub.get("address"),"ALLOCATE");
            var holding=UUID.randomUUID();db.update("INSERT INTO holding(id,offering_id,address,units,synthetic) VALUES (?,?,?,?,?) ON CONFLICT(offering_id,address) DO UPDATE SET units=holding.units+excluded.units",holding,offering,sub.get("address"),allotted,synthetic);
            holding=db.queryForObject("SELECT id FROM holding WHERE offering_id=? AND address=?",UUID.class,offering,sub.get("address"));
            var allocation=UUID.randomUUID();db.update("INSERT INTO allocation(id,subscription_id,holding_id,units) VALUES (?,?,?,?)",allocation,uuid(sub,"id"),holding,allotted);
            db.update("UPDATE subscription SET status='ALLOCATED',refunded_units=units-? WHERE id=?",allotted,uuid(sub,"id"));
            if(!synthetic) createJob("MINT",allocation);
        }
        db.update("UPDATE offering SET status='FUNDED' WHERE id=?",offering);audit(actor,"ALLOCATE",offering,"접수 시각·고정 ID 순 배정. 초과분 모의 환불. 실제 체인 발행은 별도 작업");return offering();
    }
    @Transactional public void underfunded(WalletPrincipal actor,UUID offering) {
        requireOperator(actor);var o=lockedOffering(offering);
        long used=db.queryForObject("SELECT coalesce(sum(units),0) FROM subscription WHERE offering_id=? AND status='ACCEPTED'",Long.class,offering);
        if(!o.get("status").equals("OPEN")||used>=number(o,"target_units")) throw BusinessFailure.conflict("모집 중인 미달 상품만 모의 환불할 수 있습니다.");
        db.update("UPDATE subscription SET status='REFUNDED',refunded_units=units WHERE offering_id=? AND status='ACCEPTED'",offering);
        db.update("UPDATE offering SET status='REFUNDED' WHERE id=?",offering);audit(actor,"REFUND_UNDERFUNDED",offering,"모집 미달 모의 환불. 보유 생성 없음");
    }
    @Transactional public Map<String,Object> calculate(WalletPrincipal actor,UUID evidenceId,String requestedReason) {
        if(!isReviewer(actor)) throw BusinessFailure.forbidden();var reason=reason(requestedReason);
        var e=one("SELECT * FROM evidence WHERE id=?",evidenceId);var offeringId=uuid(e,"offering_id");var o=lockedOffering(offeringId);
        var start=YearMonth.parse(o.get("starts_on").toString().substring(0,7));var period=YearMonth.parse(e.get("period").toString());
        if(period.isBefore(start)||!period.isBefore(start.plusMonths(number(o,"months")))) throw BusinessFailure.conflict("계약 기간 밖의 매출은 정산할 수 없습니다.");
        if(!e.get("status").equals("CLOSED")) throw BusinessFailure.conflict("마감된 증빙만 정산할 수 있습니다.");
        var previous=rows("SELECT * FROM settlement WHERE offering_id=? AND period=? ORDER BY version DESC LIMIT 1",offeringId,e.get("period"));
        if(!(o.get("status").equals("FUNDED")||o.get("status").equals("MATURED")&&!previous.isEmpty())) throw BusinessFailure.conflict("모집 성공 상품만 정산하며 만기 뒤 새 기간의 정산은 생성하지 않습니다.");
        if(!previous.isEmpty() && previous.getFirst().get("evidence_id").equals(evidenceId.toString())) return settlement(actor,uuid(previous.getFirst(),"id"));
        if(!previous.isEmpty()&&!previous.getFirst().get("status").equals("APPROVED")) throw BusinessFailure.conflict("이전 정산을 먼저 승인해 주세요.");
        var holdings=rows("SELECT * FROM holding WHERE offering_id=? ORDER BY id",offeringId);
        if(holdings.stream().mapToLong(h->number(h,"units")).sum()!=number(o,"target_units")) throw BusinessFailure.conflict("전체 보유 수량이 모집 수량과 일치하지 않습니다.");
        @SuppressWarnings("unchecked") var report=(Map<String,Object>)e.get("report");long net=Long.parseLong((String)report.get("netWon"));long pool=SettlementMath.pool(net,(int)number(o,"rate_bps"));
        var shares=SettlementMath.distribute(pool,holdings.stream().map(h->new SettlementMath.Position((String)h.get("id"),number(h,"units"))).toList());
        var id=UUID.randomUUID();int version=previous.isEmpty()?1:(int)number(previous.getFirst(),"version")+1;
        var snapshot=encode(new TreeMap<>(Map.of("offeringId",offeringId,"contractVersion",o.get("contract_version"),"sourceHash",e.get("source_hash"),"period",e.get("period"),"algorithm","largest-remainder-v1","positions",holdings.stream().map(h->Map.of("id",h.get("id"),"units",h.get("units"))).toList(),"shares",shares,"netWon",""+net,"poolWon",""+pool)));
        var random=new byte[32];new SecureRandom().nextBytes(random);var salt=HexFormat.of().formatHex(random);var digest=Hash.sha3String(salt+":"+snapshot);
        UUID prior=previous.isEmpty()?null:uuid(previous.getFirst(),"id");
        db.update("INSERT INTO settlement(id,offering_id,evidence_id,period,version,previous_id,net_sales,pool_won,cash_available,algorithm,status,created_by,reason,snapshot,salt,digest) VALUES (?,?,?,?,?,?,?,?,?,?,'REVIEW',?,?,?,?,?)",id,offeringId,evidenceId,e.get("period"),version,prior,net,pool,SettlementMath.cash(net),"largest-remainder-v1",actor.address(),reason,snapshot,salt,digest);
        for(var share:shares) {
            var h=holdings.stream().filter(p->p.get("id").equals(share.id())).findFirst().orElseThrow();
            long paid=db.queryForObject("SELECT coalesce(sum(l.paid_won),0) FROM settlement_line l JOIN settlement s ON s.id=l.settlement_id WHERE s.offering_id=? AND s.period=? AND l.holding_id=?",Long.class,offeringId,e.get("period"),UUID.fromString(share.id()));
            long old=prior==null?0:db.queryForObject("SELECT amount_won FROM settlement_line WHERE settlement_id=? AND holding_id=?",Long.class,prior,UUID.fromString(share.id()));
            db.update("INSERT INTO settlement_line(id,settlement_id,holding_id,address,units,amount_won,prior_paid_won,delta_won) VALUES (?,?,?,?,?,?,?,?)",UUID.randomUUID(),id,UUID.fromString(share.id()),h.get("address"),number(h,"units"),share.amount(),paid,share.amount()-old);
        }
        audit(actor,"CALCULATE",id,reason);return settlement(actor,id);
    }
    @Transactional public Map<String,Object> approve(WalletPrincipal actor,UUID id,String requestedReason) {
        if(!isReviewer(actor)) throw BusinessFailure.forbidden();var reason=reason(requestedReason);var s=one("SELECT * FROM settlement WHERE id=? FOR UPDATE",id);
        if(s.get("created_by").equals(actor.address())) throw BusinessFailure.conflict("산정자와 승인자는 다른 지갑이어야 합니다.");
        if(!s.get("status").equals("REVIEW")) throw BusinessFailure.conflict("검토 중인 정산만 승인할 수 있습니다.");
        if(!Hash.sha3String(s.get("salt")+":"+s.get("snapshot")).equals(s.get("digest"))) throw BusinessFailure.conflict("정산 원본 digest가 일치하지 않습니다.");
        db.update("UPDATE settlement SET status='APPROVED',approved_by=? WHERE id=?",actor.address(),id);createJob("SETTLEMENT",id);audit(actor,"APPROVE_SETTLEMENT",id,reason);return settlement(actor,id);
    }
    public Map<String,Object> settlement(WalletPrincipal actor,UUID id) {
        var s=one("SELECT * FROM settlement WHERE id=?",id);boolean reviewer=isReviewer(actor);
        var lines=reviewer?rows("SELECT * FROM settlement_line WHERE settlement_id=? ORDER BY id",id):rows("SELECT * FROM settlement_line WHERE settlement_id=? AND address=?",id,actor.address());
        if(lines.isEmpty()&&!reviewer) throw BusinessFailure.forbidden();
        s.remove("salt");s.remove("snapshot");s.put("lines",lines);s.put("mode","SIMULATION");s.put("tax","미설정 · 세전 금액");return s;
    }
    @Transactional(isolation=org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
    public Map<String,Object> statement(WalletPrincipal actor,UUID id) {
        var s=settlement(actor,id);var own=rows("SELECT * FROM settlement_line WHERE settlement_id=? AND address=?",id,actor.address());
        if(own.isEmpty()) throw BusinessFailure.forbidden();
        var line=own.getFirst();var o=one("SELECT * FROM offering WHERE id=?",uuid(s,"offering_id"));var e=one("SELECT id,status,source_hash FROM evidence WHERE id=?",uuid(s,"evidence_id"));
        long paid=number(line,"paid_won")+number(line,"prior_paid_won");var result=new LinkedHashMap<String,Object>();
        result.put("id",id.toString());result.put("period",s.get("period"));result.put("version",s.get("version"));result.put("status",s.get("status"));
        result.put("latest",number(s,"version")==db.queryForObject("SELECT max(version) FROM settlement WHERE offering_id=? AND period=?",Integer.class,uuid(s,"offering_id"),s.get("period")));
        result.put("netSalesWon",s.get("net_sales"));result.put("rateBps",o.get("rate_bps"));result.put("totalUnits",o.get("target_units"));result.put("ownUnits",line.get("units"));
        result.put("poolWon",s.get("pool_won"));result.put("amountWon",line.get("amount_won"));result.put("priorPaidWon",line.get("prior_paid_won"));result.put("paidWon",line.get("paid_won"));
        result.put("unpaidWon",Long.toString(Math.max(0,number(line,"amount_won")-paid)));result.put("overpaidWon",Long.toString(Math.max(0,paid-number(line,"amount_won"))));result.put("deltaWon",line.get("delta_won"));
        result.put("cashAvailableWon",s.get("cash_available"));result.put("cashShortfallWon",Long.toString(Math.max(0,number(s,"pool_won")-number(s,"cash_available"))));
        result.put("dataVersion",s.get("digest"));result.put("evidenceId",e.get("id"));result.put("evidenceStatus",e.get("status"));result.put("sourceHash",e.get("source_hash"));result.put("algorithm",s.get("algorithm"));
        result.put("payments",rows("SELECT id,requested_won,paid_won,outcome,created_at FROM payment_attempt WHERE line_id=? ORDER BY created_at,id",uuid(line,"id")));
        result.put("mode","SIMULATION");return result;
    }
    @Transactional public Map<String,Object> pay(WalletPrincipal actor,UUID lineId,long requested,String outcome,UUID requestKey) {
        requireOperator(actor);if(requested<=0||requestKey==null||!Set.of("SUCCESS","PARTIAL","FAIL").contains(outcome)) throw BusinessFailure.invalid("지급 금액·결과·요청 키를 확인해 주세요.");
        var old=rows("SELECT * FROM payment_attempt WHERE request_key=?",requestKey);
        if(!old.isEmpty()) {if(!old.getFirst().get("line_id").equals(lineId.toString())||number(old.getFirst(),"requested_won")!=requested) throw BusinessFailure.conflict("같은 요청 키의 지급 대상 또는 금액이 다릅니다.");return old.getFirst();}
        var lookup=one("SELECT l.settlement_id,s.offering_id FROM settlement_line l JOIN settlement s ON s.id=l.settlement_id WHERE l.id=?",lineId);lockedOffering(uuid(lookup,"offering_id"));var s=one("SELECT * FROM settlement WHERE id=? FOR UPDATE",uuid(lookup,"settlement_id"));
        var line=one("SELECT * FROM settlement_line WHERE id=? FOR UPDATE",lineId);
        old=rows("SELECT * FROM payment_attempt WHERE request_key=?",requestKey);
        if(!old.isEmpty()) {if(!old.getFirst().get("line_id").equals(lineId.toString())||number(old.getFirst(),"requested_won")!=requested) throw BusinessFailure.conflict("같은 요청 키의 내용이 다릅니다.");return old.getFirst();}
        if(!s.get("status").equals("APPROVED") || db.queryForObject("SELECT max(version) FROM settlement WHERE offering_id=? AND period=?",Integer.class,uuid(s,"offering_id"),s.get("period"))!=number(s,"version")) throw BusinessFailure.conflict("승인된 최신 정산만 지급할 수 있습니다.");
        long due=Math.max(0,number(line,"amount_won")-number(line,"prior_paid_won")-number(line,"paid_won"));
        if(requested>due) throw BusinessFailure.conflict("미지급 잔액을 초과합니다.");
        long paid=outcome.equals("FAIL")?0:outcome.equals("PARTIAL")?Math.max(1,requested/2):requested;
        long consumed=db.queryForObject("SELECT coalesce(sum(prior_paid_won+paid_won),0) FROM settlement_line WHERE settlement_id=?",Long.class,uuid(s,"id"));
        if(paid>Math.max(0,number(s,"cash_available")-consumed)) throw BusinessFailure.conflict("현금 여력을 초과합니다. 의무액과 지급 가능액을 구분해 주세요.");
        var id=UUID.randomUUID();db.update("INSERT INTO payment_attempt(id,line_id,request_key,requested_won,paid_won,outcome,actor) VALUES (?,?,?,?,?,?,?)",id,lineId,requestKey,requested,paid,paid==0?"FAILED":paid==requested?"SIMULATED_SUCCESS":"SIMULATED_PARTIAL",actor.address());
        db.update("UPDATE settlement_line SET paid_won=paid_won+? WHERE id=?",paid,lineId);audit(actor,"SIMULATE_PAYMENT",id,"실제 금전 지급 없음 · "+outcome);return one("SELECT * FROM payment_attempt WHERE id=?",id);
    }
    @Transactional public void mature(WalletPrincipal actor,UUID id) {
        requireOperator(actor);var o=lockedOffering(id);if(!o.get("status").equals("FUNDED")) throw BusinessFailure.conflict("모집 성공 상품만 만기 처리할 수 있습니다.");
        db.update("UPDATE offering SET status='MATURED' WHERE id=?",id);audit(actor,"SIMULATE_MATURITY",id,"미래 정산 종료 · 기존 미지급 청구 보존");
    }
    public Map<String,Object> digestCheck(WalletPrincipal actor,UUID id,boolean tamper) {
        requireOperator(actor);var s=one("SELECT * FROM settlement WHERE id=?",id);var candidate=s.get("snapshot")+(tamper?" ":"");var computed=Hash.sha3String(s.get("salt")+":"+candidate);
        return Map.of("recordedDigest",s.get("digest"),"computedDigest",computed,"matches",computed.equals(s.get("digest")),"candidateModified",tamper);
    }
    @Transactional public Map<String,Object> reset(WalletPrincipal actor) {
        requireOperator(actor);db.queryForObject("SELECT singleton FROM demo_state WHERE singleton=true FOR UPDATE",Boolean.class);
        var id=UUID.randomUUID();db.update("INSERT INTO demo_run(id,label) VALUES (?,?)",id,"해커톤 시연 "+Instant.now());db.update("UPDATE demo_state SET run_id=? WHERE singleton=true",id);createOffering(id);audit(actor,"NEW_DEMO_RUN",id,"이전 DB·온체인 이력 보존");return offering();
    }
    private void createOffering(UUID run) {var id=UUID.randomUUID();db.update("INSERT INTO offering(id,run_id,store_name,owner_address,title,target_units,unit_price,rate_bps,months,status,token_id) VALUES (?,?,?,?,?,3600,10000,300,60,'OPEN',?)",id,run,"성수 모퉁이 식당",operator,"성수 모퉁이 · 매출배분 1호",new java.math.BigDecimal(new BigInteger(id.toString().replace("-",""),16)));}
    public void createJob(String kind,UUID reference) {db.update("INSERT INTO chain_job(id,run_id,kind,reference_id,status) VALUES (?,?,?,?,'AWAITING_DEPLOYMENT') ON CONFLICT(kind,reference_id) DO NOTHING",UUID.randomUUID(),runId(),kind,reference);}
    public List<Map<String,Object>> rows(String sql,Object... args) {
        return db.queryForList(sql,args).stream().map(row->{var mapped=new LinkedHashMap<String,Object>();row.forEach((k,v)->{
            Object value=v;if(v instanceof UUID) value=v.toString();else if(v instanceof Timestamp t) value=t.toInstant().toString();else if(v instanceof java.sql.Date d) value=d.toLocalDate().toString();
            else if(v instanceof java.math.BigDecimal n) value=n.toPlainString();
            else if(v instanceof Number && (k.endsWith("_won")||Set.of("unit_price","net_sales","cash_available","token_id").contains(k))) value=v.toString();
            else if(k.equals("report")&&v!=null) value=decode(v.toString());mapped.put(k,value);
        });return (Map<String,Object>)mapped;}).toList();
    }
    public Map<String,Object> one(String sql,Object... args) {var rows=rows(sql,args);if(rows.isEmpty()) throw BusinessFailure.missing();return rows.getFirst();}
    public String encode(Object value) {return json.writeValueAsString(value);}
    public Map<?,?> decode(String value) {return json.readValue(value,Map.class);}
    public static UUID uuid(Map<String,Object> row,String field) {return UUID.fromString(row.get(field).toString());}
    public static long number(Map<String,Object> row,String field) {return Long.parseLong(row.get(field).toString());}
    public static String reason(String value) {if(value==null||value.isBlank()||value.length()>500) throw BusinessFailure.invalid("사유를 1~500자로 입력해 주세요.");return value.strip();}
}
