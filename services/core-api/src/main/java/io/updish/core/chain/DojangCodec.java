package io.updish.core.chain;

import java.math.BigInteger;
import java.util.Locale;

public final class DojangCodec {
    public static final String SCROLL = "0xd5077b67dcb56cac8b270c7788fc3e6ee03f17b9";
    public static final String EAS = "0x4200000000000000000000000000000000000021";
    public static final String FAUCET = "0xaa92f8c143657dde575de430aecaea6ca91f2e6072339b16932d426895d8d678";
    public static final String VERIFIED_SELECTOR = "0xba03e205";
    public static final String UID_SELECTOR = "0xec3a1e20";

    private DojangCodec() {}

    public static String address(String value) {
        if (value == null || !value.matches("0x[0-9a-fA-F]{40}")) {
            throw new IllegalArgumentException("A 20-byte EVM address is required");
        }
        return value.toLowerCase(Locale.ROOT);
    }

    public static String calldata(String selector, String address) {
        return selector + "0".repeat(24) + address(address).substring(2) + FAUCET.substring(2);
    }

    public static String word(Object value) {
        if (!(value instanceof String hex) || !hex.matches("0x[0-9a-fA-F]{64}")) {
            throw new ChainFailure("CONTRACT_INVALID_RESPONSE");
        }
        return hex.toLowerCase(Locale.ROOT);
    }

    public static boolean bool(Object value) {
        var number = new BigInteger(word(value).substring(2), 16);
        if (!number.equals(BigInteger.ZERO) && !number.equals(BigInteger.ONE)) {
            throw new ChainFailure("CONTRACT_INVALID_RESPONSE");
        }
        return number.equals(BigInteger.ONE);
    }

    public static String quantity(Object value) {
        if (!(value instanceof String hex) || !hex.matches("0x(0|[1-9a-fA-F][0-9a-fA-F]*)")) {
            throw new ChainFailure("RPC_INVALID_RESPONSE");
        }
        return new BigInteger(hex.substring(2), 16).toString();
    }
}
