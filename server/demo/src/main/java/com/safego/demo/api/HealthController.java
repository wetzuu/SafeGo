package com.safego.demo.api;

import com.safego.demo.data.DashboardService;
import com.safego.demo.data.RiskPolicy;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/health")
public class HealthController {
    private final DashboardService dashboard;

    public HealthController(DashboardService dashboard) {
        this.dashboard = dashboard;
    }

    @GetMapping
    public ResponseEntity<Object> health() {
        return ResponseEntity.ok()
            .cacheControl(CacheControl.noStore())
            .body(ApiResponse.ok(Map.of(
                "status", "ready",
                "service", "safego-api",
                "modelVersion", RiskPolicy.get().modelVersion(),
                "pilotId", RiskPolicy.get().pilot().id()
            ), dashboard.backend()));
    }
}
