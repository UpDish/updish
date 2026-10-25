package io.updish.core.auth;

import io.updish.core.chain.GiwaService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class AuthController {
    private final SiweService siwe;
    private final GiwaService giwa;
    private final HttpSessionSecurityContextRepository contexts;
    private final SessionAuthenticationStrategy sessions;
    public AuthController(SiweService siwe, GiwaService giwa, HttpSessionSecurityContextRepository contexts,
            SessionAuthenticationStrategy sessions) {
        this.siwe = siwe; this.giwa = giwa; this.contexts = contexts; this.sessions = sessions;
    }
    public record ChallengeRequest(@NotBlank @Size(max=42) String address) {}
    public record VerifyRequest(@NotNull UUID challengeId, @NotBlank @Size(max=2000) String message,
            @NotBlank @Size(max=132) String signature) {}

    @GetMapping("/auth/csrf")
    Map<String, String> csrf(CsrfToken token, HttpServletResponse response) {
        response.setHeader("Cache-Control", "no-store");
        return Map.of("token", token.getToken(), "headerName", token.getHeaderName());
    }
    @GetMapping("/auth/session")
    Map<String, Object> session(@AuthenticationPrincipal WalletPrincipal principal, HttpServletResponse response) {
        response.setHeader("Cache-Control", "no-store");
        return sessionView(principal);
    }
    @PostMapping("/auth/challenge")
    SiweService.Challenge challenge(@Valid @RequestBody ChallengeRequest body, HttpServletRequest request) {
        return siwe.challenge(body.address(), request.getSession(true).getId(), request.getHeader("Origin"));
    }
    @PostMapping("/auth/verify")
    Map<String, Object> verify(@Valid @RequestBody VerifyRequest body, HttpServletRequest request, HttpServletResponse response) {
        var existing = request.getSession(false);
        if (existing == null) throw AuthFailure.invalid();
        var principal = siwe.verify(body.challengeId(), body.message(), body.signature(), existing.getId(), request.getHeader("Origin"));
        var authentication = UsernamePasswordAuthenticationToken.authenticated(principal, null,
                List.of(new SimpleGrantedAuthority("ROLE_" + principal.role())));
        sessions.onAuthentication(authentication, request, response);
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication); SecurityContextHolder.setContext(context);
        contexts.saveContext(context, request, response);
        response.setHeader("Cache-Control", "no-store");
        return sessionView(principal);
    }
    @GetMapping("/me/dojang")
    GiwaService.Verification myDojang(@AuthenticationPrincipal WalletPrincipal principal, HttpServletResponse response) {
        response.setHeader("Cache-Control", "no-store");
        return giwa.verify(principal.address());
    }
    private Map<String, Object> sessionView(WalletPrincipal principal) {
        return principal == null ? Map.of("authenticated", false) : Map.of("authenticated", true,
                "user", Map.of("id", principal.id(), "address", principal.address(), "role", principal.role()), "chainId", 91342);
    }
}
