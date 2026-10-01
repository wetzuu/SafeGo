package com.safego.demo.api;

import java.time.Instant;
import java.util.Map;

public final class ApiResponse {

    private ApiResponse() {}

    public static Map<String, Object> ok(Object data, String backend) {
        return Map.of(
            "data", data,
            "meta", Map.of(
                "backend", backend,
                "generatedAt", Instant.now().toString()
            )
        );
    }

    public static Map<String, Object> error(String code, String message) {
        return Map.of("error", Map.of("code", code, "message", message));
    }

    public static org.springframework.http.ResponseEntity<Object> noStore(Object body) {
        return org.springframework.http.ResponseEntity.ok()
            .header(org.springframework.http.HttpHeaders.CACHE_CONTROL, "no-store")
            .body(body);
    }
}
