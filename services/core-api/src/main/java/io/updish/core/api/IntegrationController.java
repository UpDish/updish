package io.updish.core.api;

import io.updish.core.chain.GiwaService;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class IntegrationController {
    private final GiwaService giwa;

    public IntegrationController(GiwaService giwa) { this.giwa = giwa; }

    @GetMapping("/api/v1/chain/status")
    public GiwaService.Network network() { return giwa.network(); }

    @GetMapping("/api/v1/dojang/{address}")
    public GiwaService.Verification verification(@PathVariable String address) {
        return giwa.verify(address);
    }

    @GetMapping("/api/v1/integrations")
    public Map<String, Object> integrations() {
        return Map.of("mode", "SIMULATION", "bojagi", Map.of("status", "NOT_CONNECTED",
                "reason", "Official SDK and test environment access have not been verified"));
    }
}
