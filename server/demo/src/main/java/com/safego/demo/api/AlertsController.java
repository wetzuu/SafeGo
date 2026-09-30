package com.safego.demo.api;

import com.safego.demo.data.DashboardService;
import com.safego.demo.data.PagasaCapService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Active PAGASA alerts that touch Metro Manila, with their area polygons, for the area map. */
@RestController
@RequestMapping("/api/alerts/active")
public class AlertsController {
    // Metro Manila with a small margin, plus probe points across it for polygons that enclose the region.
    private static final double MIN_LAT = 14.30, MAX_LAT = 14.85, MIN_LON = 120.85, MAX_LON = 121.20;
    private static final double[][] PROBES = {
        {14.60, 120.98}, {14.68, 121.05}, {14.55, 121.03}, {14.45, 121.02}, {14.72, 120.96},
    };

    private final DashboardService dashboard;

    public AlertsController(DashboardService dashboard) {
        this.dashboard = dashboard;
    }

    public record AlertArea(String description, List<List<double[]>> polygons) {}

    public record ActiveAlert(
        String id, String event, String headline, String description, String severity, int severityScore,
        String urgency, String certainty, String issuedAt, String expiresAt, String sourceUrl, List<AlertArea> areas
    ) {}

    @GetMapping
    public ResponseEntity<Object> active() {
        PagasaCapService.Result result = dashboard.pagasaAlerts();
        List<ActiveAlert> alerts = new ArrayList<>();
        for (PagasaCapService.CapAlert alert : result.alerts()) {
            List<AlertArea> areas = new ArrayList<>();
            for (PagasaCapService.Area area : alert.areas()) {
                List<List<double[]>> polygons = area.polygons().stream().filter(AlertsController::touchesMetroManila).toList();
                if (!polygons.isEmpty()) areas.add(new AlertArea(area.description(), polygons));
            }
            if (areas.isEmpty()) continue;
            alerts.add(new ActiveAlert(alert.id(), alert.event(), alert.headline(), alert.description(), alert.severity(),
                PagasaCapService.severityScore(alert), alert.urgency(), alert.certainty(),
                alert.sent() == null ? null : alert.sent().toString(), alert.expires().toString(), alert.sourceUrl(), areas));
        }
        return LocationsController.noStore(ApiResponse.ok(
            Map.of("alerts", alerts, "source", result.status()), dashboard.backend()));
    }

    static boolean touchesMetroManila(List<double[]> polygon) {
        for (double[] point : polygon) {
            if (point[0] >= MIN_LAT && point[0] <= MAX_LAT && point[1] >= MIN_LON && point[1] <= MAX_LON) return true;
        }
        for (double[] probe : PROBES) {
            if (PagasaCapService.contains(polygon, probe[0], probe[1])) return true;
        }
        return false;
    }
}
