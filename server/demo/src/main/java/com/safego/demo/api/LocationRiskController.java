package com.safego.demo.api;

import com.safego.demo.data.DashboardService;
import com.safego.demo.model.LocationRiskDetails;
import com.safego.demo.model.LocationSummary;
import com.safego.demo.model.RiskAssessment;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/locations")
public class LocationRiskController {
    private final DashboardService dashboard;

    public LocationRiskController(DashboardService dashboard) {
        this.dashboard = dashboard;
    }

    @GetMapping("/{id}/risk")
    public ResponseEntity<Object> risk(@PathVariable String id) {
        return dashboard.snapshot(false).locations().stream().filter(location -> location.id().equals(id)).findFirst()
            .map(location -> {
                RiskAssessment risk = location.risk();
                LocationSummary summary = new LocationSummary(location.id(), location.name(), location.city(),
                    location.aliases(), location.coordinates(), location.updated(), new LocationSummary.RiskSummary(
                        risk.key(), risk.name(), risk.rank(), risk.percentage(), risk.modelVersion()));
                return LocationsController.noStore(ApiResponse.ok(new LocationRiskDetails(summary, risk,
                    location.factors(), location.advisories(), location.reports()), dashboard.backend()));
            })
            .orElseGet(() -> ResponseEntity.status(404)
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(ApiResponse.error("LOCATION_NOT_FOUND", "That SafeGo location was not found.")));
    }
}
