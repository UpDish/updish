package io.updish.core.auth;

import java.net.URI;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public final class OriginPolicy {
    private final Set<String> allowed;
    public OriginPolicy(@Value("${updish.auth.allowed-origins}") String origins) {
        allowed = Arrays.stream(origins.split(",")).map(String::trim).collect(Collectors.toUnmodifiableSet());
        for (var origin : allowed) {
            var uri = URI.create(origin);
            boolean loopback = Set.of("localhost", "127.0.0.1", "[::1]").contains(uri.getHost());
            if (uri.getHost() == null || uri.getUserInfo() != null || uri.getQuery() != null
                    || uri.getFragment() != null || !uri.getRawPath().isEmpty()
                    || !("https".equals(uri.getScheme()) || (loopback && "http".equals(uri.getScheme())))) {
                throw new IllegalStateException("Configure exact HTTPS origins, or HTTP loopback origins for development.");
            }
        }
    }
    public String require(String origin) {
        if (origin == null || !allowed.contains(origin)) {
            throw new AuthFailure("ORIGIN_REJECTED", 403, "허용되지 않은 로그인 출처입니다.");
        }
        return origin;
    }
}
