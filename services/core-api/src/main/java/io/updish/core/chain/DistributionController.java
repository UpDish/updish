package io.updish.core.chain;
import io.updish.core.auth.WalletPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping("/api/v1/workbench")
public class DistributionController {
    private final DistributionService service;private final ChainJobs jobs;
    public DistributionController(DistributionService service,ChainJobs jobs){this.service=service;this.jobs=jobs;}
    public record Contracts(@NotBlank String cashAddress,@NotBlank String vaultAddress){}
    @GetMapping("/distributions") Object receipts(@AuthenticationPrincipal WalletPrincipal a){return service.receipts(a);}
    @PostMapping("/distribution/contracts") Object register(@AuthenticationPrincipal WalletPrincipal a,@Valid @RequestBody Contracts b){return jobs.registerDistribution(a,b.cashAddress(),b.vaultAddress());}
    @PostMapping("/settlements/{id}/fund-distribution") Object fund(@AuthenticationPrincipal WalletPrincipal a,@PathVariable UUID id){return service.fund(a,id);}
    @PostMapping("/lines/{id}/distribute") Object pay(@AuthenticationPrincipal WalletPrincipal a,@PathVariable UUID id){return service.pay(a,id);}
}
