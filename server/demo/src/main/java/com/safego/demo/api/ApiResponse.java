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
}
