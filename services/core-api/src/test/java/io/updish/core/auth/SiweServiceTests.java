package io.updish.core.auth;

import static org.junit.jupiter.api.Assertions.*;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.web3j.crypto.ECKeyPair;
import org.web3j.crypto.Keys;
import org.web3j.crypto.Sign;

@SpringBootTest
class SiweServiceTests {
    private static final String ORIGIN = "http://127.0.0.1:3000";
    @Autowired SiweService siwe;
    @Autowired JdbcTemplate db;
    private final List<String> addresses = new ArrayList<>();
    private final List<UUID> challenges = new ArrayList<>();
    private final String session = UUID.randomUUID().toString();

    @AfterEach void cleanup() {
        for (var id : challenges) db.update("DELETE FROM siwe_challenge WHERE id = ?", id);
        for (var address : addresses) db.update("DELETE FROM wallet_user WHERE address = ?", address);
    }
    private ECKeyPair key() throws Exception {
        var pair = Keys.createEcKeyPair(); addresses.add("0x" + Keys.getAddress(pair)); return pair;
    }
    private SiweService.Challenge challenge(ECKeyPair pair) {
        var c = siwe.challenge("0x" + Keys.getAddress(pair), session, ORIGIN); challenges.add(c.challengeId()); return c;
    }
    private String signature(String message, ECKeyPair pair) {
        var sig = Sign.signPrefixedMessage(message.getBytes(StandardCharsets.UTF_8), pair);
        return "0x" + HexFormat.of().formatHex(sig.getR()) + HexFormat.of().formatHex(sig.getS()) + HexFormat.of().formatHex(sig.getV());
    }
    private WalletPrincipal verify(SiweService.Challenge c, ECKeyPair pair) {
        return siwe.verify(c.challengeId(), c.message(), signature(c.message(), pair), session, ORIGIN);
    }
    @Test void realEip191SignatureCreatesInvestorAndNonceIsSingleUse() throws Exception {
        var pair = key(); var c = challenge(pair);
        assertTrue(c.message().startsWith(ORIGIN + " wants you to sign in with your Ethereum account:\n" + Keys.toChecksumAddress("0x" + Keys.getAddress(pair))));
        assertTrue(c.message().contains("\nURI: " + ORIGIN + "\nVersion: 1\nChain ID: 91342\nNonce: "));
        assertEquals("INVESTOR", verify(c, pair).role());
        assertThrows(AuthFailure.class, () -> verify(c, pair));
    }
    @Test void rejectsSignedTamperingOfEverySecurityField() throws Exception {
        var pair = key(); var c = challenge(pair);
        for (var modified : List.of(c.message().replace("91342", "1"), c.message().replace("127.0.0.1:3000 wants", "evil.example wants"),
                c.message().replace("URI: " + ORIGIN, "URI: https://evil.example"), c.message().replace("Version: 1", "Version: 2"),
                c.message().replace("Nonce: ", "Nonce: 0000"), c.message().replace("Issued At: 2", "Issued At: 1"),
                c.message().replace("Expiration Time: 2", "Expiration Time: 3"))) {
            assertThrows(AuthFailure.class, () -> siwe.verify(c.challengeId(), modified, signature(modified, pair), session, ORIGIN));
        }
        assertNotNull(verify(c, pair));
    }
    @Test void wrongSignerCannotLogin() throws Exception {
        var pair = key(); var other = key(); var c = challenge(pair);
        assertThrows(AuthFailure.class, () -> verify(c, other));
        assertNotNull(verify(c, pair));
    }
    @Test void bindsChallengeToBrowserSessionAndExactOrigin() throws Exception {
        var pair = key(); var c = challenge(pair); var sig = signature(c.message(), pair);
        assertThrows(AuthFailure.class, () -> siwe.verify(c.challengeId(), c.message(), sig, "other-session", ORIGIN));
        assertThrows(AuthFailure.class, () -> siwe.verify(c.challengeId(), c.message(), sig, session, "http://localhost:3000"));
        assertThrows(AuthFailure.class, () -> siwe.verify(c.challengeId(), c.message(), sig, session, "https://evil.example"));
        assertNotNull(verify(c, pair));
    }
    @Test void expiredChallengeCannotLogin() throws Exception {
        var pair = key(); var c = challenge(pair);
        db.update("UPDATE siwe_challenge SET expires_at = now() - interval '1 second' WHERE id = ?", c.challengeId());
        assertThrows(AuthFailure.class, () -> verify(c, pair));
    }
    @Test void newChallengeInvalidatesPriorChallengeInSameBrowser() throws Exception {
        var pair = key(); var first = challenge(pair); var second = challenge(pair);
        assertThrows(AuthFailure.class, () -> verify(first, pair));
        assertNotNull(verify(second, pair));
    }
    @Test void concurrentReplayHasExactlyOneWinner() throws Exception {
        var pair = key(); var c = challenge(pair); var sig = signature(c.message(), pair);
        var attempts = new ArrayList<CompletableFuture<Boolean>>();
        for (int i = 0; i < 2; i++) attempts.add(CompletableFuture.supplyAsync(() -> {
            try { siwe.verify(c.challengeId(), c.message(), sig, session, ORIGIN); return true; }
            catch (AuthFailure failure) { return false; }
        }));
        assertEquals(1, attempts.stream().map(CompletableFuture::join).filter(Boolean::booleanValue).count());
    }
    @Test void malformedSignatureAndForbiddenOriginAreRejected() throws Exception {
        var pair = key(); var c = challenge(pair);
        assertThrows(AuthFailure.class, () -> siwe.verify(c.challengeId(), c.message(), "0x" + "00".repeat(65), session, ORIGIN));
        assertThrows(AuthFailure.class, () -> siwe.challenge("0x" + Keys.getAddress(pair), session, "https://evil.example"));
    }
}
