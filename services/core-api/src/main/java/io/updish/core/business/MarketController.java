package io.updish.core.business;
import io.updish.core.auth.WalletPrincipal;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/v1/workbench")
public class MarketController {
    private final MarketService service;
    public MarketController(MarketService service){this.service=service;}
    @GetMapping("/market") Object catalog(@AuthenticationPrincipal WalletPrincipal a){return service.catalog(a);}
    @GetMapping("/investments") Object portfolio(@AuthenticationPrincipal WalletPrincipal a){return service.portfolio(a);}
    @Deprecated @GetMapping("/benefits") Object removedBenefits(){throw new BusinessFailure("FEATURE_REMOVED",410,"고객 혜택 기능은 데모 범위에서 제거했습니다. 운영 투명성 화면을 확인해 주세요.");}
    @Deprecated @PostMapping("/benefits/{benefitId}/claim") Object removedClaim(){throw new BusinessFailure("FEATURE_REMOVED",410,"쿠폰 발급 기능은 제거됐습니다.");}
}
