package io.updish.core.auth;

import java.io.Serializable;
import java.security.Principal;
import java.util.UUID;

public record WalletPrincipal(UUID id, String address, String role) implements Principal, Serializable {
    @Override public String getName() { return address; }
}
