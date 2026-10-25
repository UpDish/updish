package io.updish.core.api;

import io.updish.core.chain.ChainFailure;
import io.updish.core.auth.AuthFailure;
import io.updish.core.business.BusinessFailure;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiErrors {
    @ExceptionHandler(BusinessFailure.class)
    ResponseEntity<?> business(BusinessFailure e) { return ResponseEntity.status(e.status()).body(Map.of("code",e.code(),"message",e.getMessage())); }
    @ExceptionHandler({org.springframework.web.bind.MethodArgumentNotValidException.class,org.springframework.http.converter.HttpMessageNotReadableException.class})
    ResponseEntity<?> input(Exception e) { return ResponseEntity.badRequest().body(Map.of("code","INVALID_INPUT","message","입력 형식을 확인해 주세요.")); }
    @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
    ResponseEntity<?> conflict(Exception e) { return ResponseEntity.status(409).body(Map.of("code","CONFLICT","message","중복 요청 또는 현재 상태와 충돌합니다. 새로고침 후 다시 확인해 주세요.")); }
    @ExceptionHandler(AuthFailure.class)
    ResponseEntity<?> auth(AuthFailure exception) {
        return ResponseEntity.status(exception.status()).body(Map.of("code", exception.code(), "message", exception.getMessage()));
    }
    @ExceptionHandler(ChainFailure.class)
    ResponseEntity<?> chain(ChainFailure exception) {
        return ResponseEntity.status(503).body(Map.of("code", exception.code(),
                "message", "체인 조회를 완료하지 못했습니다. 잠시 후 다시 확인해 주세요."));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<?> validation(IllegalArgumentException exception) {
        return ResponseEntity.badRequest().body(Map.of("code", "INVALID_ADDRESS",
                "message", "0x로 시작하는 20바이트 지갑 주소를 입력해 주세요."));
    }
}
