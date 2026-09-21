package com.safego.demo.api;

import com.safego.demo.data.DashboardService;
import com.safego.demo.model.LocationSummary;
import com.safego.demo.model.RiskAssessment;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/locations")
public class LocationsController {
    private final DashboardService dashboard;

    public LocationsController(DashboardService dashboard) {
        this.dashboard = dashboard;
    }

    @GetMapping
    public ResponseEntity<Object> list() {
        return noStore(ApiResponse.ok(dashboard.snapshot(false).locations().stream().map(location -> {
            RiskAssessment risk = location.risk();
            return new LocationSummary(location.id(), location.name(), location.city(), location.aliases(),
                location.coordinates(), location.updated(), new LocationSummary.RiskSummary(
                    risk.key(), risk.name(), risk.rank(), risk.percentage(), risk.modelVersion()));
        }).toList(), dashboard.backend()));
    }

    static ResponseEntity<Object> noStore(Object body) {
        return ResponseEntity.ok()
            .header(HttpHeaders.CACHE_CONTROL, "no-store")
            .body(body);
    }
}
