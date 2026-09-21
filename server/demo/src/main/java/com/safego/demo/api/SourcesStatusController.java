package com.safego.demo.api;

import com.safego.demo.data.DashboardService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/sources/status")
public class SourcesStatusController {
    private final DashboardService dashboard;

    public SourcesStatusController(DashboardService dashboard) {
        this.dashboard = dashboard;
    }

    @GetMapping
    public ResponseEntity<Object> status() {
        return LocationsController.noStore(ApiResponse.ok(dashboard.snapshot(false).sources(), dashboard.backend()));
    }
}
