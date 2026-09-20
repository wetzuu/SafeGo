package com.safego.demo.api;

import com.safego.demo.data.MockRepository;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@RestController
@RequestMapping("/api/reports")
public class ReportsController {

    private static final long WINDOW_MS = 10 * 60 * 1_000L;
    private static final int MAX_PER_WINDOW = 5;
    private static final List<String> VALID_TYPES = List.of(
        "Flooding", "Road Hazard", "Transport Disruption", "Power / Signal Outage", "Other"
    );
    private static final ConcurrentHashMap<String, List<Long>> submissions = new ConcurrentHashMap<>();

    @PostMapping
    public ResponseEntity<Object> submit(
            @RequestBody(required = false) Map<String, Object> body,
            @RequestHeader(value = "X-Forwarded-For", required = false) String forwarded,
            @RequestHeader(value = "X-Real-Ip", required = false) String realIp) {

        boolean enabled =
            "true".equals(System.getenv("SAFEGO_COMMUNITY_REPORTS_ENABLED"))
            && "true".equals(System.getenv("SAFEGO_MODERATION_ENABLED"));

        if (!enabled) {
            return ResponseEntity.status(503)
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(ApiResponse.error("REPORTING_DISABLED",
                    "Community submissions are disabled until moderation is available."));
        }

        if (body == null) {
            return ResponseEntity.status(400)
                .body(ApiResponse.error("INVALID_JSON", "Send the report as valid JSON."));
        }

        String locationId  = clean(body.get("locationId"));
        String reportType  = clean(body.get("reportType"));
        String locationText = clean(body.get("locationText"));
        String description = clean(body.get("description"));

        if (!locationId.matches("[a-z0-9-]{1,80}")) {
            return ResponseEntity.status(400)
                .body(ApiResponse.error("INVALID_REPORT", "Choose a valid SafeGo coverage location."));
        }
        if (!VALID_TYPES.contains(reportType)) {
            return ResponseEntity.status(400)
                .body(ApiResponse.error("INVALID_REPORT", "Choose a valid report type."));
        }
        if (locationText.length() < 3 || locationText.length() > 160) {
            return ResponseEntity.status(400)
                .body(ApiResponse.error("INVALID_REPORT", "Enter a location between 3 and 160 characters."));
        }
        if (description.length() < 10 || description.length() > 500) {
            return ResponseEntity.status(400)
                .body(ApiResponse.error("INVALID_REPORT", "Describe what you observed in 10 to 500 characters."));
        }

        String clientKey = clientKey(forwarded, realIp);
        if (!acceptsSubmission(clientKey)) {
            return ResponseEntity.status(429)
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .header("Retry-After", "600")
                .body(ApiResponse.error("RATE_LIMITED",
                    "Too many reports were submitted. Try again in a few minutes."));
        }

        return MockRepository.submitCommunityReport(locationId, reportType, locationText, description)
            .map(report -> ResponseEntity.status(201)
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .<Object>body(Map.of(
                    "data", report,
                    "meta", Map.of("backend", "mock", "generatedAt", Instant.now().toString())
                )))
            .orElseGet(() -> ResponseEntity.status(404)
                .body(ApiResponse.error("LOCATION_NOT_FOUND",
                    "That SafeGo coverage location no longer exists.")));
    }

    private static String clean(Object value) {
        if (!(value instanceof String s)) return "";
        return s.replaceAll("\\s+", " ").trim();
    }

    private static String clientKey(String forwarded, String realIp) {
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        if (realIp != null && !realIp.isBlank()) return realIp.trim();
        return "local";
    }

    private static boolean acceptsSubmission(String key) {
        long now = System.currentTimeMillis();
        List<Long> times = submissions.computeIfAbsent(key, k -> new CopyOnWriteArrayList<>());
        List<Long> recent = times.stream().filter(t -> now - t < WINDOW_MS).toList();
        if (recent.size() >= MAX_PER_WINDOW) {
            submissions.put(key, new CopyOnWriteArrayList<>(recent));
            return false;
        }
        List<Long> updated = new CopyOnWriteArrayList<>(recent);
        updated.add(now);
        submissions.put(key, updated);
        return true;
    }
}
