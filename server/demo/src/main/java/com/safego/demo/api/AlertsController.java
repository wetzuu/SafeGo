package com.safego.demo.api;

import com.safego.demo.data.DashboardService;
import com.safego.demo.data.PagasaCapService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Optional;
import java.util.Set;
import java.util.List;
import java.util.Map;

/** Active PAGASA alerts that touch Metro Manila, with their area polygons, for the area map. */
@RestController
@RequestMapping("/api/alerts")
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

    @GetMapping("/active")
    public ResponseEntity<Object> active() {
        PagasaCapService.Result result = dashboard.pagasaAlerts();
        List<ActiveAlert> alerts = new ArrayList<>();
        for (PagasaCapService.CapAlert alert : result.alerts()) metroManilaView(alert).ifPresent(alerts::add);
        return ApiResponse.noStore(ApiResponse.ok(
            Map.of("alerts", alerts, "source", result.status()), dashboard.backend()));
    }

    /** The university suspension scan: what was checked and what was found. force=true scans now. */
    @GetMapping("/universities")
    public ResponseEntity<Object> universities(@RequestParam(defaultValue = "false") boolean force) {
        return ApiResponse.noStore(ApiResponse.ok(dashboard.universityScan(force), dashboard.backend()));
    }

    public record TimelineHour(String time, List<String> alertIds) {}

    /**
     * For each hour of the last four days, the PAGASA alerts that were in force over Metro Manila,
     * using the same rules as "active now" applied at that hour. Feeds the map time slider.
     */
    @GetMapping("/timeline")
    public ResponseEntity<Object> timeline() {
        PagasaCapService.Result recent = dashboard.pagasaRecentAlerts();
        Map<String, ActiveAlert> views = new LinkedHashMap<>();
        for (PagasaCapService.CapAlert alert : recent.alerts()) metroManilaView(alert).ifPresent(view -> views.put(view.id(), view));

        List<TimelineHour> hours = new ArrayList<>();
        Instant end = Instant.now().truncatedTo(ChronoUnit.HOURS);
        for (Instant hour = end.minus(Duration.ofDays(4)); !hour.isAfter(end); hour = hour.plus(Duration.ofHours(1))) {
            List<String> ids = PagasaCapService.active(recent.alerts(), hour).stream()
                .map(PagasaCapService.CapAlert::id).filter(views::containsKey).toList();
            hours.add(new TimelineHour(hour.toString(), ids));
        }
        Set<String> used = new HashSet<>();
        hours.forEach(hour -> used.addAll(hour.alertIds()));
        List<ActiveAlert> alerts = views.values().stream().filter(view -> used.contains(view.id())).toList();
        return ApiResponse.noStore(ApiResponse.ok(
            Map.of("alerts", alerts, "hours", hours, "source", recent.status()), dashboard.backend()));
    }

    /** The alert with only its Metro Manila polygons, or empty when it does not touch Metro Manila. */
    static Optional<ActiveAlert> metroManilaView(PagasaCapService.CapAlert alert) {
        List<AlertArea> areas = new ArrayList<>();
        for (PagasaCapService.Area area : alert.areas()) {
            List<List<double[]>> polygons = area.polygons().stream().filter(AlertsController::touchesMetroManila).toList();
            if (!polygons.isEmpty()) areas.add(new AlertArea(area.description(), polygons));
        }
        if (areas.isEmpty() || alert.expires() == null) return Optional.empty();
        return Optional.of(new ActiveAlert(alert.id(), alert.event(), alert.headline(), alert.description(), alert.severity(),
            PagasaCapService.severityScore(alert), alert.urgency(), alert.certainty(),
            alert.sent() == null ? null : alert.sent().toString(), alert.expires().toString(), alert.sourceUrl(), areas));
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
