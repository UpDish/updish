package io.updish.core.business;

import io.updish.core.auth.WalletPrincipal;
import java.util.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.web3j.crypto.Hash;

@RestController @RequestMapping("/api/v1/workbench/agent")
public class AgentChatController {
    private final TransparencyService transparency;private final AgentGateway gateway;private final WorkbenchService work;
    public AgentChatController(TransparencyService transparency,AgentGateway gateway,WorkbenchService work){this.transparency=transparency;this.gateway=gateway;this.work=work;}
    public record Question(String question,String storeId){}
    @SuppressWarnings("unchecked") Map<String,Object> context(WalletPrincipal actor,String storeId){
        var data=transparency.read(actor,storeId);var context=new LinkedHashMap<String,Object>();context.put("store",data.get("store"));
        context.put("approved",((List<?>)data.get("approved")).stream().limit(3).toList());context.put("samples",data.get("samples"));context.put("submissions",((List<?>)data.get("submissions")).stream().limit(3).toList());
        context.put("guide","가게 목록에서 계약과 매출을 확인하고 청약하기 팝업으로 모의 투자한다. 투자 내역에서 접수·보유·개인 정산을 확인한다. 운영 투명성에서 POS 결제·PG 정산·은행 입금을 대조한다. 누락·불일치 자료는 승인을 막는다. 가게가 제출하고 별도 검토자가 마감하며 정산 산정자와 승인자도 분리한다. 내 정산 질문은 투자 내역의 Agent에게 질문에서 연다. 실제 자금 이동과 주문·쿠폰 기능은 없다. TESTNET FAUCET은 실명 인증이 아니다. Bojagi는 미연결이다. 체인 해시는 저장된 작업 상태이며 이 요청에서 체인을 재검증하지 않는다.");
        var ids=new ArrayList<String>(List.of("updish-demo-guide-v1",storeId));for(var key:List.of("approved","samples"))for(var row:(List<Map<String,Object>>)context.get(key))ids.add(row.get("id").toString());
        context.put("sourceIds",ids);context.put("mode","SIMULATION");context.put("dataVersion",Hash.sha3String(work.encode(context)));return context;
    }
    @PostMapping("/chat") Object chat(@AuthenticationPrincipal WalletPrincipal actor,@RequestBody Question body){
        var question=WorkbenchService.reason(body.question());var storeId=body.storeId()==null?"store-seongsu":body.storeId();
        return gateway.explain(actor,null,question,context(actor,storeId));
    }
}
