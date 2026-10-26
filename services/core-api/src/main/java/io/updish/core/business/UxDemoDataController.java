package io.updish.core.business;
import io.updish.core.auth.WalletPrincipal;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/workbench/demo-data")
public class UxDemoDataController {
    private final UxDemoDataService service;
    public UxDemoDataController(UxDemoDataService service){this.service=service;}
    @GetMapping Object dataset(@AuthenticationPrincipal WalletPrincipal actor){return service.dataset(actor);}
    @GetMapping("/personas/{personaId}") Object persona(@AuthenticationPrincipal WalletPrincipal actor,@PathVariable String personaId){return service.persona(actor,personaId);}
}
