package io.updish.core.business;

import io.updish.core.auth.WalletPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.Map;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class WorkbenchController {
    private final WorkbenchService service;
    public WorkbenchController(WorkbenchService service) {this.service=service;}
    public record Subscription(@Min(1) @Max(3600) int units,@NotNull UUID requestKey,boolean understood) {}
    public record Evidence(@NotNull UUID offeringId,@NotBlank String period,@NotBlank @Size(max=120) String filename,@NotBlank @Size(max=1000000) String csv) {}
    public record Reason(@NotBlank @Size(max=500) String reason) {}
    public record Member(@NotBlank String address,@NotBlank String role,boolean ownStore) {}
    public record Calculation(@NotNull UUID evidenceId,@NotBlank @Size(max=500) String reason) {}
    public record Payment(@Min(1) long amountWon,@NotBlank String outcome,@NotNull UUID requestKey) {}
    public record Digest(boolean tamper) {}
    @GetMapping("/offerings/current") Object offering() {return service.offering();}
    @GetMapping("/offerings/current/performance") Object performance() {return service.performance();}
    @GetMapping("/workbench/dashboard") Object dashboard(@AuthenticationPrincipal WalletPrincipal actor) {return service.dashboard(actor);}
    @PostMapping("/workbench/members") Object member(@AuthenticationPrincipal WalletPrincipal a,@Valid @RequestBody Member b) {return service.member(a,b.address(),b.role(),b.ownStore());}
    @PostMapping("/workbench/evidence") Object evidence(@AuthenticationPrincipal WalletPrincipal a,@Valid @RequestBody Evidence b) {return service.submitEvidence(a,b.offeringId(),b.period(),b.filename(),b.csv());}
    @GetMapping("/workbench/evidence/{id}") Object evidence(@AuthenticationPrincipal WalletPrincipal a,@PathVariable UUID id) {return service.evidence(a,id);}
    @PostMapping("/workbench/evidence/{id}/close") Object close(@AuthenticationPrincipal WalletPrincipal a,@PathVariable UUID id,@Valid @RequestBody Reason b) {return service.closeEvidence(a,id,b.reason());}
    @PostMapping("/workbench/offerings/{id}/subscribe") Object subscribe(@AuthenticationPrincipal WalletPrincipal a,@PathVariable UUID id,@Valid @RequestBody Subscription b) {return service.subscribe(a,id,b.units(),b.requestKey(),b.understood());}
    @PostMapping("/workbench/subscriptions/{id}/cancel") Object cancel(@AuthenticationPrincipal WalletPrincipal a,@PathVariable UUID id) {service.cancel(a,id);return Map.of("status","CANCELLED");}
    @PostMapping("/workbench/background") Object background(@AuthenticationPrincipal WalletPrincipal a) {return service.background(a);}
    @PostMapping("/workbench/offerings/{id}/allocate") Object allocate(@AuthenticationPrincipal WalletPrincipal a,@PathVariable UUID id) {return service.allocate(a,id);}
    @PostMapping("/workbench/offerings/{id}/underfunded") Object underfunded(@AuthenticationPrincipal WalletPrincipal a,@PathVariable UUID id) {service.underfunded(a,id);return Map.of("status","REFUNDED");}
    @PostMapping("/workbench/settlements") Object calculate(@AuthenticationPrincipal WalletPrincipal a,@Valid @RequestBody Calculation b) {return service.calculate(a,b.evidenceId(),b.reason());}
    @GetMapping("/workbench/settlements/{id}") Object settlement(@AuthenticationPrincipal WalletPrincipal a,@PathVariable UUID id) {return service.settlement(a,id);}
    @GetMapping("/workbench/settlements/{id}/statement") Object statement(@AuthenticationPrincipal WalletPrincipal a,@PathVariable UUID id) {return service.statement(a,id);}
    @PostMapping("/workbench/settlements/{id}/approve") Object approve(@AuthenticationPrincipal WalletPrincipal a,@PathVariable UUID id,@Valid @RequestBody Reason b) {return service.approve(a,id,b.reason());}
    @PostMapping("/workbench/settlements/{id}/digest") Object digest(@AuthenticationPrincipal WalletPrincipal a,@PathVariable UUID id,@RequestBody Digest b) {return service.digestCheck(a,id,b.tamper());}
    @PostMapping("/workbench/lines/{id}/pay") Object pay(@AuthenticationPrincipal WalletPrincipal a,@PathVariable UUID id,@Valid @RequestBody Payment b) {return service.pay(a,id,b.amountWon(),b.outcome(),b.requestKey());}
    @PostMapping("/workbench/offerings/{id}/mature") Object mature(@AuthenticationPrincipal WalletPrincipal a,@PathVariable UUID id) {service.mature(a,id);return Map.of("status","MATURED");}
    @PostMapping("/workbench/reset") Object reset(@AuthenticationPrincipal WalletPrincipal a) {return service.reset(a);}
}
