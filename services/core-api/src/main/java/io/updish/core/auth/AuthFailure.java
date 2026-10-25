package io.updish.core.auth;

public final class AuthFailure extends RuntimeException {
    private final String code;
    private final int status;
    public AuthFailure(String code, int status, String message) {
        super(message); this.code = code; this.status = status;
    }
    public String code() { return code; }
    public int status() { return status; }
    public static AuthFailure invalid() {
        return new AuthFailure("INVALID_SIWE", 401, "로그인 서명을 확인하지 못했습니다. 새 서명을 요청해 주세요.");
    }
}
