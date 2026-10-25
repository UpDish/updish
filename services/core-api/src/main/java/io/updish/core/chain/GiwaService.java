package io.updish.core.chain;

import java.math.BigInteger;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public final class GiwaService {
    private final RpcClient rpc;

    public GiwaService(RpcClient rpc) { this.rpc = rpc; }

    public record Network(String network, int chainId, String blockNumber,
            Map<String, Integer> contractCodeBytes, String checkedAt, String mode, String blockTag) {}
    public record Verification(String address, String status, boolean verified, String attester,
            String attesterId, String attestationUid, String blockNumber, String checkedAt,
            String mode, String disclaimer, String blockTag) {}
    private record Snapshot(String blockHex, String blockNumber, Map<String, Integer> contracts) {}

    private Snapshot snapshot() {
        if (!"91342".equals(DojangCodec.quantity(rpc.call("eth_chainId", List.of())))) {
            throw new ChainFailure("WRONG_CHAIN");
        }
        var safeResult = rpc.call("eth_getBlockByNumber", List.of("safe", false));
        if (!(safeResult instanceof Map<?, ?> safeBlock)) throw new ChainFailure("SAFE_BLOCK_UNAVAILABLE");
        var blockValue = safeBlock.get("number");
        var block = DojangCodec.quantity(blockValue);
        var contracts = Map.of("DojangScroll", codeBytes(DojangCodec.SCROLL, blockValue),
                "EAS", codeBytes(DojangCodec.EAS, blockValue));
        return new Snapshot((String) blockValue, block, contracts);
    }

    private int codeBytes(String address, Object block) {
        var value = rpc.call("eth_getCode", List.of(address, block));
        if (!(value instanceof String hex) || !hex.matches("0x([0-9a-fA-F]{2})+")) {
            throw new ChainFailure("CONTRACT_NOT_DEPLOYED");
        }
        return (hex.length() - 2) / 2;
    }

    public Network network() {
        var state = snapshot();
        return new Network("GIWA Sepolia", 91342, state.blockNumber(), state.contracts(),
                Instant.now().toString(), "SIMULATION", "safe");
    }

    public Verification verify(String requestedAddress) {
        var address = DojangCodec.address(requestedAddress);
        var state = snapshot();
        boolean verified = DojangCodec.bool(read(DojangCodec.VERIFIED_SELECTOR, address, state.blockHex()));
        String uid = null;
        // The official UID getter reverts for absent/revoked attestations.
        if (verified) {
            uid = DojangCodec.word(read(DojangCodec.UID_SELECTOR, address, state.blockHex()));
            if (new BigInteger(uid.substring(2), 16).signum() == 0) {
                throw new ChainFailure("CONTRACT_INCONSISTENT_RESPONSE");
            }
        }
        return new Verification(address, verified ? "VERIFIED_TESTNET" : "NOT_VERIFIED", verified,
                "TESTNET FAUCET", DojangCodec.FAUCET, uid, state.blockNumber(),
                Instant.now().toString(), "SIMULATION",
                "Testnet attestation only; this is not Upbit identity verification or investment eligibility.", "safe");
    }

    private Object read(String selector, String address, String block) {
        return rpc.call("eth_call", List.of(Map.of("to", DojangCodec.SCROLL,
                "data", DojangCodec.calldata(selector, address)), block));
    }
}
