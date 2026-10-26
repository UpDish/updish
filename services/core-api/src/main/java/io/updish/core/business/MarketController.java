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
    @GetMapping("/benefits") Object benefits(@AuthenticationPrincipal WalletPrincipal a){return service.benefits(a);}
    @PostMapping("/benefits/{benefitId}/claim") Object claim(@AuthenticationPrincipal WalletPrincipal a,@PathVariable String benefitId){return service.claim(a,benefitId);}
}
