package io.updish.core.chain;

public final class ChainFailure extends RuntimeException {
    private final String code;

    public ChainFailure(String code) {
        super("Chain verification is temporarily unavailable");
        this.code = code;
    }

    public String code() { return code; }
}
