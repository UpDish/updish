package io.updish.core.chain;
import io.updish.core.auth.WalletPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping("/api/v1/workbench")
public class ChainJobController {
    private final ChainJobs jobs;public ChainJobController(ChainJobs jobs) {this.jobs=jobs;}
    public record Contracts(@NotBlank String unitsAddress,@NotBlank String registryAddress) {}
    public record Transaction(@NotBlank String hash) {}
    @PostMapping("/contracts") Object register(@AuthenticationPrincipal WalletPrincipal a,@Valid @RequestBody Contracts b) {return jobs.register(a,b.unitsAddress(),b.registryAddress());}
    @PostMapping("/jobs/{id}/prepare") Object prepare(@AuthenticationPrincipal WalletPrincipal a,@PathVariable UUID id) {return jobs.prepare(a,id);}
    @PostMapping("/jobs/{id}/transaction") Object attach(@AuthenticationPrincipal WalletPrincipal a,@PathVariable UUID id,@Valid @RequestBody Transaction b) {return jobs.attach(a,id,b.hash());}
    @PostMapping("/jobs/{id}/check") Object check(@AuthenticationPrincipal WalletPrincipal a,@PathVariable UUID id) {return jobs.reconcile(a,id);}
    @PostMapping("/jobs/{id}/retry") Object retry(@AuthenticationPrincipal WalletPrincipal a,@PathVariable UUID id) {return jobs.retry(a,id);}
}
