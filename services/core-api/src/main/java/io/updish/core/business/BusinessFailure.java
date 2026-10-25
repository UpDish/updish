package io.updish.core.business;

public final class BusinessFailure extends RuntimeException {
    private final String code;
    private final int status;
    public BusinessFailure(String code, int status, String message) { super(message); this.code=code; this.status=status; }
    public String code() { return code; }
    public int status() { return status; }
    public static BusinessFailure conflict(String message) { return new BusinessFailure("STATE_CONFLICT",409,message); }
    public static BusinessFailure forbidden() { return new BusinessFailure("FORBIDDEN",403,"이 자료를 조회하거나 변경할 권한이 없습니다."); }
    public static BusinessFailure invalid(String message) { return new BusinessFailure("INVALID_INPUT",400,message); }
    public static BusinessFailure missing() { return new BusinessFailure("NOT_FOUND",404,"자료를 찾을 수 없습니다."); }
}
