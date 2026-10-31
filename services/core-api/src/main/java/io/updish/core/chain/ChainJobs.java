package io.updish.core.chain;

import io.updish.core.auth.WalletPrincipal;
import io.updish.core.business.*;
import static io.updish.core.business.WorkbenchService.*;
import java.math.BigInteger;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.web3j.crypto.Hash;

@Service
public class ChainJobs {
    private final RpcClient rpc;private final GiwaService giwa;private final WorkbenchService work;private final JdbcTemplate db;private final DistributionService distribution;
    public ChainJobs(RpcClient rpc,GiwaService giwa,WorkbenchService work,JdbcTemplate db,DistributionService distribution) {this.rpc=rpc;this.giwa=giwa;this.work=work;this.db=db;this.distribution=distribution;}
    private String block() {
        if(!DojangCodec.quantity(rpc.call("eth_chainId",List.of())).equals("91342")) throw new ChainFailure("WRONG_CHAIN");
        var b=asMap(rpc.call("eth_getBlockByNumber",List.of("latest",false)));return (String)b.get("number");
    }
    private Map<?,?> asMap(Object value) {if(!(value instanceof Map<?,?> m)) throw new ChainFailure("RPC_INVALID_RESPONSE");return m;}
    private String read(String target,String signature,String data,String block) {
        var value=rpc.call("eth_call",List.of(Map.of("to",target,"data",selector(signature)+data),block));
        if(!(value instanceof String hex)||!hex.matches("0x[0-9a-fA-F]*")) throw new ChainFailure("INVALID_CONTRACT_RESULT");return hex.toLowerCase(Locale.ROOT);
    }
    private String addressResult(String value) {return "0x"+DojangCodec.word(value).substring(26);}
    @Transactional public Map<String,Object> register(WalletPrincipal actor,String units,String registry) {
        work.requireOperator(actor);units=DojangCodec.address(units);registry=DojangCodec.address(registry);var block=block();var o=work.offering();
        var code=verifiedCode(units,"UpDishDemoUnits",block);var registryCode=verifiedCode(registry,"SettlementRegistry",block);
        if(!addressResult(read(units,"owner()","",block)).equals(actor.address())||!addressResult(read(registry,"owner()","",block)).equals(actor.address())
                ||!addressResult(read(units,"scroll()","",block)).equals(DojangCodec.SCROLL)
                ||!DojangCodec.word(read(units,"allowedAttester()","",block)).equals(DojangCodec.FAUCET)
                ||!new BigInteger(DojangCodec.word(read(units,"offeringTokenId()","",block)).substring(2),16).toString().equals(o.get("token_id"))
                ||new BigInteger(DojangCodec.word(read(units,"cap()","",block)).substring(2),16).longValueExact()!=number(o,"target_units")) throw BusinessFailure.invalid("배포 계약의 소유자·Dojang·상품·수량 설정이 일치하지 않습니다.");
        if(db.queryForObject("SELECT count(*) FROM chain_job WHERE run_id=? AND tx_hash IS NOT NULL",Long.class,work.runId())>0) {
            var existing=work.rows("SELECT * FROM chain_config WHERE offering_id=?",uuid(o,"id"));
            if(existing.isEmpty()||!existing.getFirst().get("units_address").equals(units)||!existing.getFirst().get("registry_address").equals(registry)) throw BusinessFailure.conflict("거래 제출 후에는 해당 시연의 계약을 바꿀 수 없습니다.");
        }
        var distributions=work.rows("SELECT * FROM distribution_config WHERE offering_id=?",uuid(o,"id"));
        if(!distributions.isEmpty()&&(!units.equals(distributions.getFirst().get("units_address"))||!registry.equals(distributions.getFirst().get("registry_address"))))throw BusinessFailure.conflict("분배 계약과 연결된 수량·기록 계약은 새 시연에서 변경해 주세요.");
        db.update("INSERT INTO chain_config(singleton,offering_id,units_address,registry_address,operator_address,checked_block,units_code_hash,registry_code_hash) VALUES (true,?,?,?,?,?,?,?) ON CONFLICT(singleton) DO UPDATE SET offering_id=excluded.offering_id,units_address=excluded.units_address,registry_address=excluded.registry_address,operator_address=excluded.operator_address,checked_block=excluded.checked_block,units_code_hash=excluded.units_code_hash,registry_code_hash=excluded.registry_code_hash",uuid(o,"id"),units,registry,actor.address(),Long.parseLong(DojangCodec.quantity(block)),Hash.sha3(code),Hash.sha3(registryCode));
        work.audit(actor,"REGISTER_CONTRACTS",uuid(o,"id"),"빌드 runtime·소유자·설정 온체인 대조");return Map.of("unitsAddress",units,"registryAddress",registry,"chainId",91342);
    }
    @Transactional public Map<String,Object> registerDistribution(WalletPrincipal actor,String cash,String vault){
        work.requireOperator(actor);cash=DojangCodec.address(cash);vault=DojangCodec.address(vault);var tag=block();
        verifiedCode(cash,"UpDishDemoCash",tag);verifiedCode(vault,"UpDishDistribution",tag);
        var c=work.one("SELECT * FROM chain_config WHERE offering_id=?",uuid(work.offering(),"id"));
        distribution.validateConfiguration(actor,cash,vault,c,tag);
        return Map.of("cashAddress",cash,"vaultAddress",vault,"asset","DEMO","mode","SIMULATION");
    }
    private String verifiedCode(String address,String name,String block) {
        var value=rpc.call("eth_getCode",List.of(address,block));if(!(value instanceof String code)||code.length()<4) throw new ChainFailure("CONTRACT_NOT_DEPLOYED");
        try(var input=getClass().getResourceAsStream("/chain/runtime-manifest.json")) {
            if(input==null) throw new ChainFailure("BUILD_MANIFEST_MISSING");
            var root=work.decode(new String(input.readAllBytes(),java.nio.charset.StandardCharsets.UTF_8));var spec=(Map<?,?>)root.get(name);
            var expected=HexFormat.of().parseHex(spec.get("runtime").toString().replaceFirst("^0x",""));var actual=HexFormat.of().parseHex(code.substring(2));
            if(expected.length!=actual.length) throw BusinessFailure.invalid("검증된 빌드와 다른 컨트랙트입니다.");
            for(Object entry:(List<?>)spec.get("immutableRanges")) {var range=(List<?>)entry;int start=((Number)range.get(0)).intValue(),length=((Number)range.get(1)).intValue();Arrays.fill(expected,start,start+length,(byte)0);Arrays.fill(actual,start,start+length,(byte)0);}
            if(!Arrays.equals(expected,actual)) throw BusinessFailure.invalid("검증된 빌드와 다른 컨트랙트입니다.");return code;
        } catch(java.io.IOException e) {throw new ChainFailure("BUILD_MANIFEST_UNAVAILABLE");}
    }
    @Transactional public Map<String,Object> prepare(WalletPrincipal actor,UUID id) {
        work.requireOperator(actor);var job=work.one("SELECT * FROM chain_job WHERE id=? AND run_id=? FOR UPDATE",id,work.runId());
        if(!Set.of("AWAITING_DEPLOYMENT","AWAITING_SIGNATURE").contains(job.get("status"))) return job;
        if(DistributionService.handles(job.get("kind").toString()))return distribution.prepare(job);
        var config=work.rows("SELECT * FROM chain_config WHERE offering_id=?",uuid(work.offering(),"id"));
        if(config.isEmpty()) return job;var c=config.getFirst();String target,data;
        if(job.get("kind").equals("MINT")) {
            var allocation=work.one("SELECT a.*,h.address,h.offering_id FROM allocation a JOIN holding h ON h.id=a.holding_id WHERE a.id=?",uuid(job,"reference_id"));
            var o=work.one("SELECT token_id FROM offering WHERE id=?",uuid(allocation,"offering_id"));target=(String)c.get("units_address");
            data=selector("mintAllocation(bytes32,address,uint256,uint256)")+word(uuid(job,"reference_id"))+"0".repeat(24)+allocation.get("address").toString().substring(2)+word(new BigInteger(o.get("token_id").toString()))+word(BigInteger.valueOf(number(allocation,"units")));
        } else {
            var s=work.one("SELECT * FROM settlement WHERE id=?",uuid(job,"reference_id"));target=(String)c.get("registry_address");
            data=selector("record(bytes32,bytes32,bytes32,bytes32)")+word(work.runId())+word(uuid(s,"id"))+s.get("digest").toString().substring(2)+(s.get("previous_id")==null?"0".repeat(64):word(uuid(s,"previous_id")));
        }
        db.update("UPDATE chain_job SET target=?,calldata=?,status='AWAITING_SIGNATURE' WHERE id=?",target,data,id);return work.one("SELECT * FROM chain_job WHERE id=?",id);
    }
    @Transactional public Map<String,Object> attach(WalletPrincipal actor,UUID id,String hash) {
        work.requireOperator(actor);if(hash==null||!hash.matches("0x[0-9a-fA-F]{64}")) throw BusinessFailure.invalid("거래 해시를 확인해 주세요.");hash=hash.toLowerCase(Locale.ROOT);
        var job=prepare(actor,id);
        if(job.get("tx_hash")!=null) {if(!job.get("tx_hash").equals(hash)) throw BusinessFailure.conflict("이미 다른 거래가 연결돼 있습니다. 확인 전에는 다시 제출하지 않습니다.");return job;}
        if(!job.get("status").equals("AWAITING_SIGNATURE")) throw BusinessFailure.conflict("계약 등록과 작업 준비가 필요합니다.");
        db.update("INSERT INTO chain_attempt(tx_hash,job_id) VALUES (?,?)",hash,id);
        db.update("UPDATE chain_job SET tx_hash=?,status='SUBMITTED',error_code=null WHERE id=?",hash,id);return reconcile(actor,id);
    }
    @Transactional public Map<String,Object> reconcile(WalletPrincipal actor,UUID id) {
        work.requireOperator(actor);var job=work.one("SELECT * FROM chain_job WHERE id=? AND run_id=? FOR UPDATE",id,work.runId());
        if(job.get("tx_hash")==null) return prepare(actor,id);
        try {
            block();var txValue=rpc.callNullable("eth_getTransactionByHash",List.of(job.get("tx_hash")));
            if(txValue==null) return pending(id,"TRANSACTION_NOT_FOUND");var tx=asMap(txValue);
            if(!job.get("target").toString().equalsIgnoreCase(Objects.toString(tx.get("to"),""))||!actor.address().equalsIgnoreCase(Objects.toString(tx.get("from"),""))||!job.get("calldata").toString().equalsIgnoreCase(Objects.toString(tx.get("input"),""))||!"0".equals(DojangCodec.quantity(tx.get("value")))) return pending(id,"TRANSACTION_MISMATCH");
            var receiptValue=rpc.callNullable("eth_getTransactionReceipt",List.of(job.get("tx_hash")));if(receiptValue==null) return pending(id,"RECEIPT_PENDING");var receipt=asMap(receiptValue);
            if(!"1".equals(DojangCodec.quantity(receipt.get("status")))) {db.update("UPDATE chain_job SET status='FAILED',error_code='TX_REVERTED' WHERE id=?",id);return work.one("SELECT * FROM chain_job WHERE id=?",id);}
            long included=Long.parseLong(DojangCodec.quantity(receipt.get("blockNumber")));var canonical=asMap(rpc.call("eth_getBlockByNumber",List.of(receipt.get("blockNumber"),false)));
            if(!Objects.equals(canonical.get("hash"),receipt.get("blockHash"))) return pending(id,"BLOCK_CHANGED");
            var safe=giwa.network();boolean safeEnough=included<=Long.parseLong(safe.blockNumber());
            if(safeEnough) {
                var tag="0x"+new BigInteger(safe.blockNumber()).toString(16);
                if(job.get("kind").equals("MINT")) {
                    var a=work.one("SELECT a.*,h.address,h.units AS holding_units,o.token_id FROM allocation a JOIN holding h ON h.id=a.holding_id JOIN offering o ON o.id=h.offering_id WHERE a.id=?",uuid(job,"reference_id"));
                    if(!DojangCodec.bool(read(job.get("target").toString(),"allocations(bytes32)",word(uuid(job,"reference_id")),tag))) return pending(id,"ALLOCATION_NOT_CONFIRMED");
                    var balance=new BigInteger(DojangCodec.word(read(job.get("target").toString(),"balanceOf(address,uint256)","0".repeat(24)+a.get("address").toString().substring(2)+word(new BigInteger(a.get("token_id").toString())),tag)).substring(2),16).longValueExact();
                    if(balance>number(a,"holding_units")) return pending(id,"BALANCE_MISMATCH");db.update("UPDATE holding SET chain_units=? WHERE id=?",balance,uuid(a,"holding_id"));
                } else if(job.get("kind").equals("SETTLEMENT")) {
                    var s=work.one("SELECT digest FROM settlement WHERE id=?",uuid(job,"reference_id"));var result=read(job.get("target").toString(),"records(bytes32)",word(uuid(job,"reference_id")),tag);
                    if(result.length()!=194||!result.substring(2,66).equals(word(work.runId()))||!result.substring(66,130).equals(s.get("digest").toString().substring(2))) return pending(id,"DIGEST_MISMATCH");
                } else if(!distribution.verify(job,tag)) {
                    return pending(id,"DISTRIBUTION_NOT_CONFIRMED");
                }
            }
            db.update("UPDATE chain_job SET status=?,block_number=?,block_hash=?,error_code=null WHERE id=?",safeEnough?"SAFE":"INCLUDED",included,receipt.get("blockHash"),id);
        } catch(ChainFailure e) {return pending(id,e.code());}
        return work.one("SELECT * FROM chain_job WHERE id=?",id);
    }
    private Map<String,Object> pending(UUID id,String reason) {db.update("UPDATE chain_job SET status='CHECK_PENDING',error_code=? WHERE id=?",reason,id);return work.one("SELECT * FROM chain_job WHERE id=?",id);}
    @Transactional public Map<String,Object> retry(WalletPrincipal actor,UUID id) {
        work.requireOperator(actor);var job=work.one("SELECT * FROM chain_job WHERE id=? AND run_id=? FOR UPDATE",id,work.runId());
        if(!job.get("status").equals("FAILED")||!"TX_REVERTED".equals(job.get("error_code"))) throw BusinessFailure.conflict("실패 영수증이 확인된 거래만 재시도할 수 있습니다.");
        db.update("UPDATE chain_job SET status='AWAITING_SIGNATURE',tx_hash=null,block_number=null,block_hash=null,error_code=null WHERE id=?",id);return work.one("SELECT * FROM chain_job WHERE id=?",id);
    }
    public static String selector(String signature) {return Hash.sha3String(signature).substring(0,10);}
    public static String word(UUID id) {return String.format("%064x",new BigInteger(id.toString().replace("-",""),16));}
    public static String word(BigInteger number) {if(number.signum()<0||number.bitLength()>256) throw BusinessFailure.invalid("체인 수량 범위를 초과합니다.");return String.format("%064x",number);}
}
