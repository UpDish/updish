package io.updish.core.auth;

import io.updish.core.chain.DojangCodec;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.web3j.crypto.Keys;
import org.web3j.crypto.Sign;

@Service
public class SiweService {
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final BigInteger HALF_ORDER = new BigInteger("7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0", 16);
    private final JdbcTemplate db;
    private final OriginPolicy origins;
    @Value("${updish.demo.operator-wallet}") private String operatorWallet;
    public SiweService(JdbcTemplate db, OriginPolicy origins) { this.db = db; this.origins = origins; }

    public record Challenge(UUID challengeId, String message, String expiresAt, int chainId) {}
    private record Stored(UUID id, String address, String message, String binding, Instant expires, boolean consumed) {}

    @Transactional
    public Challenge challenge(String requestedAddress, String sessionId, String origin) {
        origins.require(origin);
        var address = DojangCodec.address(requestedAddress);
        var now = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        var expires = now.plusSeconds(300);
        var nonceBytes = new byte[16]; RANDOM.nextBytes(nonceBytes);
        var nonce = HexFormat.of().formatHex(nonceBytes);
        var id = UUID.randomUUID();
        // Include the scheme so HTTP loopback does not implicitly claim an HTTPS origin.
        var message = origin + " wants you to sign in with your Ethereum account:\n"
                + Keys.toChecksumAddress(address) + "\n\n"
                + "Sign in to UpDish hackathon demo. No transaction or investment authorization.\n\n"
                + "URI: " + origin + "\nVersion: 1\nChain ID: 91342\nNonce: " + nonce
                + "\nIssued At: " + now + "\nExpiration Time: " + expires;
        var binding = binding(sessionId);
        db.update("DELETE FROM siwe_challenge WHERE session_binding = ? OR expires_at < now() - interval '1 day'", binding);
        db.update("INSERT INTO siwe_challenge(id, nonce, address, message, session_binding, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
                id, nonce, address, message, binding, Timestamp.from(expires));
        return new Challenge(id, message, expires.toString(), 91342);
    }

    @Transactional
    public WalletPrincipal verify(UUID challengeId, String message, String signature, String sessionId, String origin) {
        origins.require(origin);
        if (challengeId == null || message == null || message.length() > 2000 || signature == null
                || !signature.matches("0x[0-9a-fA-F]{130}")) throw AuthFailure.invalid();
        var found = db.query("SELECT * FROM siwe_challenge WHERE id = ?", (rs, row) -> new Stored(
                rs.getObject("id", UUID.class), rs.getString("address"), rs.getString("message"),
                rs.getString("session_binding"), rs.getTimestamp("expires_at").toInstant(), rs.getTimestamp("consumed_at") != null), challengeId);
        if (found.size() != 1) throw AuthFailure.invalid();
        var stored = found.getFirst();
        // Exact canonical message comparison binds domain, URI, chain, nonce and all time fields.
        if (stored.consumed() || !stored.expires().isAfter(Instant.now())
                || !stored.binding().equals(binding(sessionId)) || !stored.message().equals(message)
                || !message.contains("\nURI: " + origin + "\n")) throw AuthFailure.invalid();
        verifySignature(message, signature, stored.address());
        int consumed = db.update("UPDATE siwe_challenge SET consumed_at = now() WHERE id = ? AND session_binding = ? AND consumed_at IS NULL AND expires_at > now()",
                challengeId, stored.binding());
        if (consumed != 1) throw AuthFailure.invalid();
        // Role is assigned by the server; SIWE clients cannot request operator privileges.
        db.update("INSERT INTO wallet_user(id, address, role) VALUES (?, ?, ?) ON CONFLICT(address) DO UPDATE SET last_login_at = now()",
                UUID.randomUUID(), stored.address(), stored.address().equalsIgnoreCase(operatorWallet)?"OPERATOR":"INVESTOR");
        return db.queryForObject("SELECT id, address, role FROM wallet_user WHERE address = ?", (rs, row) ->
                new WalletPrincipal(rs.getObject("id", UUID.class), rs.getString("address"), rs.getString("role")), stored.address());
    }

    static void verifySignature(String message, String signature, String expected) {
        try {
            byte[] bytes = HexFormat.of().parseHex(signature.substring(2));
            byte[] r = java.util.Arrays.copyOfRange(bytes, 0, 32);
            byte[] s = java.util.Arrays.copyOfRange(bytes, 32, 64);
            int v = Byte.toUnsignedInt(bytes[64]);
            if (v < 27) v += 27;
            var sValue = new BigInteger(1, s);
            if ((v != 27 && v != 28) || sValue.signum() == 0 || sValue.compareTo(HALF_ORDER) > 0) throw AuthFailure.invalid();
            var key = Sign.signedPrefixedMessageToKey(message.getBytes(StandardCharsets.UTF_8), new Sign.SignatureData((byte) v, r, s));
            if (!expected.equalsIgnoreCase("0x" + Keys.getAddress(key))) throw AuthFailure.invalid();
        } catch (AuthFailure failure) { throw failure; }
        catch (Exception failure) { throw AuthFailure.invalid(); }
    }

    private static String binding(String sessionId) {
        if (sessionId == null) throw AuthFailure.invalid();
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(sessionId.getBytes(StandardCharsets.UTF_8))); }
        catch (java.security.NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
    }
}
