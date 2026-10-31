package io.updish.core.chain;

import io.updish.core.auth.WalletPrincipal;
import io.updish.core.business.BusinessFailure;
import io.updish.core.business.WorkbenchService;
import static io.updish.core.business.WorkbenchService.*;
import java.math.BigInteger;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.web3j.crypto.Hash;

@Service
public class DistributionService {
    private final WorkbenchService work; private final JdbcTemplate db; private final RpcClient rpc;
    public DistributionService(WorkbenchService work,JdbcTemplate db,RpcClient rpc){this.work=work;this.db=db;this.rpc=rpc;}
    public static boolean handles(String kind){return Set.of("FUND_DISTRIBUTION","PAY_DISTRIBUTION").contains(kind);}
    public String read(String target,String signature,String data,String block){
        var value=rpc.call("eth_call",List.of(Map.of("to",target,"data",ChainJobs.selector(signature)+data),block));
        if(!(value instanceof String s)||!s.matches("0x[0-9a-fA-F]*"))throw new ChainFailure("INVALID_CONTRACT_RESULT");return s.toLowerCase(Locale.ROOT);
    }
    private String address(String result){return "0x"+DojangCodec.word(result).substring(26);}
    private long integer(String result){return new BigInteger(DojangCodec.word(result).substring(2),16).longValueExact();}
    public static String periodId(Map<String,Object> s){return Hash.sha3String("updish-distribution:"+s.get("offering_id")+":"+s.get("period"));}
    private Map<String,Object> approved(UUID id){
        var s=work.one("SELECT * FROM settlement WHERE id=? FOR UPDATE",id);
        if(!"APPROVED".equals(s.get("status"))||number(s,"version")!=db.queryForObject("SELECT max(version) FROM settlement WHERE offering_id=? AND period=?",Integer.class,uuid(s,"offering_id"),s.get("period")))throw BusinessFailure.conflict("승인된 최신 정산만 테스트 자산으로 분배할 수 있습니다.");
        if(!uuid(s,"offering_id").equals(uuid(work.offering(),"id")))throw BusinessFailure.conflict("현재 시연의 정산을 선택해 주세요.");
        return s;
    }
    public void validateConfiguration(WalletPrincipal a,String cash,String vault,Map<String,Object> c,String block){
        var o=work.offering();String expectedUnits=(String)c.get("units_address"),expectedRegistry=(String)c.get("registry_address");
        if(integer(read(cash,"decimals()","",block))!=0
            ||!address(read(vault,"owner()","",block)).equals(a.address())
            ||!address(read(vault,"cash()","",block)).equals(cash)
            ||!address(read(vault,"units()","",block)).equals(expectedUnits)
            ||!address(read(vault,"registry()","",block)).equals(expectedRegistry)
            ||!DojangCodec.word(read(vault,"runId()","",block)).substring(2).equals(ChainJobs.word(work.runId()))
            ||!new BigInteger(DojangCodec.word(read(vault,"tokenId()","",block)).substring(2),16).toString().equals(o.get("token_id"))
            ||integer(read(vault,"cap()","",block))!=number(o,"target_units"))throw BusinessFailure.invalid("테스트 자산·분배 계약의 상품·소유자·연결 설정이 일치하지 않습니다.");
        var existing=work.rows("SELECT * FROM distribution_config WHERE offering_id=?",uuid(o,"id"));
        if(!existing.isEmpty()&&db.queryForObject("SELECT count(*) FROM distribution_intent i JOIN chain_job j ON j.id=i.job_id WHERE j.run_id=? AND j.tx_hash IS NOT NULL",Integer.class,work.runId())>0
            &&(!cash.equals(existing.getFirst().get("cash_address"))||!vault.equals(existing.getFirst().get("vault_address"))))throw BusinessFailure.conflict("거래 제출 후에는 이 시연의 분배 계약을 교체할 수 없습니다.");
        db.update("INSERT INTO distribution_config(offering_id,cash_address,vault_address,units_address,registry_address,checked_block) VALUES (?,?,?,?,?,?) ON CONFLICT(offering_id) DO UPDATE SET cash_address=excluded.cash_address,vault_address=excluded.vault_address,units_address=excluded.units_address,registry_address=excluded.registry_address,checked_block=excluded.checked_block",uuid(o,"id"),cash,vault,expectedUnits,expectedRegistry,Long.parseLong(DojangCodec.quantity(block)));
        work.audit(a,"REGISTER_DISTRIBUTION",uuid(o,"id"),"검증된 DEMO 자산·분배 계약. 현금·원화 담보 없음");
    }
    private Map<String,Object> config(UUID offering){return work.one("SELECT * FROM distribution_config WHERE offering_id=?",offering);}
    @Transactional public Map<String,Object> fund(WalletPrincipal a,UUID id){
        work.requireOperator(a);var s=approved(id);config(uuid(s,"offering_id"));
        long fundedPool=db.queryForObject("SELECT coalesce(max(i.amount_units),0) FROM distribution_intent i JOIN chain_job j ON j.id=i.job_id JOIN settlement previous ON previous.id=i.settlement_id WHERE j.kind='FUND_DISTRIBUTION' AND j.status='SAFE' AND previous.offering_id=? AND previous.period=?",Long.class,uuid(s,"offering_id"),s.get("period"));
        if(Math.max(0,number(s,"pool_won")-fundedPool)>number(s,"cash_available"))throw BusinessFailure.conflict("추가 예치에 필요한 현금 여력이 부족합니다. 부족 사유를 먼저 해결해 주세요.");
        if(db.queryForObject("SELECT count(*) FROM distribution_intent i JOIN chain_job j ON j.id=i.job_id JOIN settlement prior ON prior.id=i.settlement_id WHERE prior.offering_id=? AND prior.period=? AND prior.id<>? AND j.status NOT IN ('SAFE','FAILED')",Integer.class,uuid(s,"offering_id"),s.get("period"),id)>0)throw BusinessFailure.conflict("이전 버전의 분배 거래를 먼저 확인해야 합니다. 확인 대기 거래가 있으면 새 버전을 예치하지 않습니다.");
        if(db.queryForObject("SELECT count(*) FROM chain_job WHERE kind='SETTLEMENT' AND reference_id=? AND status='SAFE'",Integer.class,id)!=1)throw BusinessFailure.conflict("먼저 승인된 정산 기록의 GIWA safe 반영을 확인해 주세요.");
        return intent(a,"FUND_DISTRIBUTION",id,s,null,number(s,"pool_won"));
    }
    @Transactional public Map<String,Object> pay(WalletPrincipal a,UUID lineId){
        work.requireOperator(a);var line=work.one("SELECT * FROM settlement_line WHERE id=?",lineId);var s=approved(uuid(line,"settlement_id"));
        config(uuid(s,"offering_id"));
        if(db.queryForObject("SELECT count(*) FROM chain_job WHERE kind='FUND_DISTRIBUTION' AND reference_id=? AND status='SAFE'",Integer.class,uuid(s,"id"))!=1)throw BusinessFailure.conflict("현재 정산의 분배 자금 예치와 safe 반영이 필요합니다.");
        var h=work.one("SELECT * FROM holding WHERE id=?",uuid(line,"holding_id"));
        if((Boolean)h.get("synthetic")||number(h,"chain_units")!=number(h,"units"))throw BusinessFailure.conflict("실제 시연 지갑의 GIWA 발행 수량이 먼저 일치해야 합니다. 가상 배경에는 송금하지 않습니다.");
        var old=work.rows("SELECT j.* FROM chain_job j WHERE kind='PAY_DISTRIBUTION' AND reference_id=?",lineId);if(!old.isEmpty())return old.getFirst();
        long previous=confirmed(uuid(s,"offering_id"),s.get("period").toString(),line.get("address").toString());
        long amount=Math.max(0,number(line,"amount_won")-previous);
        if(amount==0)throw BusinessFailure.conflict("추가로 지급할 테스트 자산이 없습니다. 기존 수령 기록은 보존됩니다.");
        return intent(a,"PAY_DISTRIBUTION",lineId,s,lineId,amount);
    }
    private Map<String,Object> intent(WalletPrincipal a,String kind,UUID reference,Map<String,Object> s,UUID line,long amount){
        var prior=work.rows("SELECT * FROM chain_job WHERE kind=? AND reference_id=?",kind,reference);if(!prior.isEmpty())return prior.getFirst();
        var id=UUID.randomUUID();db.update("INSERT INTO chain_job(id,run_id,kind,reference_id,status) VALUES (?,?,?,?,'AWAITING_SIGNATURE')",id,work.runId(),kind,reference);
        db.update("INSERT INTO distribution_intent(job_id,settlement_id,line_id,period_id,amount_units) VALUES (?,?,?,?,?)",id,uuid(s,"id"),line,periodId(s),amount);
        work.audit(a,kind,reference,"DEMO 테스트 토큰 작업 준비 · 아직 송금 완료 아님");return work.one("SELECT * FROM chain_job WHERE id=?",id);
    }
    public Map<String,Object> prepare(Map<String,Object> job){
        if(job.get("target")!=null&&job.get("calldata")!=null)return job;
        var i=work.one("SELECT * FROM distribution_intent WHERE job_id=?",uuid(job,"id"));var s=work.one("SELECT * FROM settlement WHERE id=?",uuid(i,"settlement_id"));var c=config(uuid(s,"offering_id"));
        String args=i.get("period_id").toString().substring(2)+ChainJobs.word(uuid(s,"id"));String data;
        if(job.get("kind").equals("FUND_DISTRIBUTION"))data=ChainJobs.selector("publish(bytes32,bytes32,uint256)")+args+ChainJobs.word(BigInteger.valueOf(number(i,"amount_units")));
        else{
            var l=work.one("SELECT * FROM settlement_line WHERE id=?",uuid(i,"line_id"));
            data=ChainJobs.selector("pay(bytes32,bytes32,bytes32,address,uint256,uint256)")+ChainJobs.word(uuid(job,"id"))+args+"0".repeat(24)+l.get("address").toString().substring(2)+ChainJobs.word(BigInteger.valueOf(number(l,"units")))+ChainJobs.word(BigInteger.valueOf(number(i,"amount_units")));
        }
        db.update("UPDATE chain_job SET target=?,calldata=? WHERE id=?",c.get("vault_address"),data,uuid(job,"id"));return work.one("SELECT * FROM chain_job WHERE id=?",uuid(job,"id"));
    }
    public boolean verify(Map<String,Object> job,String block){
        var i=work.one("SELECT * FROM distribution_intent WHERE job_id=?",uuid(job,"id"));var target=job.get("target").toString();
        if(job.get("kind").equals("FUND_DISTRIBUTION"))return DojangCodec.bool(read(target,"published(bytes32)",ChainJobs.word(uuid(i,"settlement_id")),block))
            &&integer(read(target,"publishedPool(bytes32)",ChainJobs.word(uuid(i,"settlement_id")),block))==number(i,"amount_units");
        return DojangCodec.bool(read(target,"payments(bytes32)",ChainJobs.word(uuid(job,"id")),block));
    }
    public long confirmed(UUID offering,String period,String recipient){
        return db.queryForObject("SELECT coalesce(sum(i.amount_units),0) FROM distribution_intent i JOIN chain_job j ON j.id=i.job_id JOIN settlement s ON s.id=i.settlement_id JOIN settlement_line l ON l.id=i.line_id WHERE j.kind='PAY_DISTRIBUTION' AND j.status='SAFE' AND s.offering_id=? AND s.period=? AND l.address=?",Long.class,offering,period,recipient);
    }
    @Transactional public Map<String,Object> receipts(WalletPrincipal a){
        work.role(a);boolean op="OPERATOR".equals(work.role(a));
        String query="SELECT j.id,j.kind,j.status,j.tx_hash,j.error_code,s.offering_id,o.store_name,s.period,s.version,i.amount_units,l.address,l.id AS line_id,c.cash_address,c.vault_address FROM distribution_intent i JOIN chain_job j ON j.id=i.job_id JOIN settlement s ON s.id=i.settlement_id JOIN offering o ON o.id=s.offering_id JOIN distribution_config c ON c.offering_id=s.offering_id LEFT JOIN settlement_line l ON l.id=i.line_id WHERE ";
        var payments=op?work.rows(query+"(j.run_id=? OR (j.kind='PAY_DISTRIBUTION' AND l.address=?)) ORDER BY j.created_at",work.runId(),a.address()):work.rows(query+"j.kind='PAY_DISTRIBUTION' AND l.address=? ORDER BY j.created_at",a.address());
        return Map.of("payments",payments,"configs",work.rows("SELECT * FROM distribution_config WHERE offering_id=?",uuid(work.offering(),"id")),"asset","DEMO","mode","SIMULATION");
    }
}
