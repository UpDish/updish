package io.updish.core.config;

import io.updish.core.auth.AuthFailure;
import io.updish.core.auth.OriginPolicy;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import java.util.Set;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.*;
import org.springframework.security.web.authentication.session.*;
import org.springframework.web.filter.OncePerRequestFilter;

@Configuration
public class SecurityConfig {
    @Bean UserDetailsService noPasswordAccounts() { return new InMemoryUserDetailsManager(); }
    @Bean HttpSessionSecurityContextRepository securityContexts() { return new HttpSessionSecurityContextRepository(); }
    @Bean HttpSessionCsrfTokenRepository csrfTokens() { return new HttpSessionCsrfTokenRepository(); }
    @Bean SessionAuthenticationStrategy sessionAuthenticationStrategy(HttpSessionCsrfTokenRepository csrf) {
        return new CompositeSessionAuthenticationStrategy(List.of(
                new ChangeSessionIdAuthenticationStrategy(), new CsrfAuthenticationStrategy(csrf)));
    }

    @Bean
    SecurityFilterChain security(HttpSecurity http, OriginPolicy origins,
            HttpSessionSecurityContextRepository contexts, HttpSessionCsrfTokenRepository csrf) {
        http.sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED));
        http.requestCache(c -> c.disable());
        http.securityContext(s -> s.securityContextRepository(contexts).requireExplicitSave(true));
        http.csrf(c -> c.csrfTokenRepository(csrf).csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler()));
        http.addFilterBefore(new OncePerRequestFilter() {
            @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                    FilterChain chain) throws ServletException, IOException {
                if (!Set.of("GET", "HEAD", "OPTIONS").contains(request.getMethod())) {
                    try { origins.require(request.getHeader("Origin")); }
                    catch (AuthFailure failure) { json(response, 403, "ORIGIN_REJECTED"); return; }
                }
                chain.doFilter(request, response);
            }
        }, CsrfFilter.class);
        http.exceptionHandling(e -> e
                .authenticationEntryPoint((request, response, failure) -> json(response, 401, "LOGIN_REQUIRED"))
                .accessDeniedHandler((request, response, failure) -> json(response, 403, "REQUEST_REJECTED")));
        http.logout(l -> l.logoutUrl("/api/v1/auth/logout").invalidateHttpSession(true)
                .deleteCookies("UPDISH_SESSION")
                .logoutSuccessHandler((request, response, authentication) -> {
                    response.setContentType("application/json"); response.getWriter().write("{\"authenticated\":false}");
                }));
        http.authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.GET, "/actuator/health", "/api/v1/chain/status", "/api/v1/dojang/*",
                        "/api/v1/integrations", "/api/v1/auth/csrf", "/api/v1/auth/session", "/api/v1/offerings/current").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/v1/auth/challenge", "/api/v1/auth/verify").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/me/dojang").authenticated()
                .requestMatchers("/api/v1/workbench/**").authenticated()
                .anyRequest().denyAll());
        return http.build();
    }
    private static void json(HttpServletResponse response, int status, String code) throws IOException {
        response.setStatus(status); response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"code\":\"" + code + "\",\"message\":\"로그인 상태와 요청 출처를 확인해 주세요.\"}");
    }
}
