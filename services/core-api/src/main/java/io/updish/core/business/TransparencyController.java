package io.updish.core.business;
import io.updish.core.auth.WalletPrincipal;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/v1/workbench")
public class TransparencyController {
    private final TransparencyService service;
    public TransparencyController(TransparencyService service){this.service=service;}
    @GetMapping({"/transparency","/transparency/{storeId}"}) Object read(@AuthenticationPrincipal WalletPrincipal a,@PathVariable(required=false) String storeId){return service.read(a,storeId==null?"store-seongsu":storeId);}
}
