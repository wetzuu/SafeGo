package com.safego.demo.api;

import com.safego.demo.data.DashboardService;
import com.safego.demo.model.*;
import com.safego.demo.service.DemoRoutes;
import com.safego.demo.service.GeocodingService;
import com.safego.demo.service.RoutingService;
import com.safego.demo.service.TripAnalysisService;
import com.safego.demo.util.GeoUtils;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/trips/analyze")
public class TripAnalyzeController {

    public static final String PILOT_ID = TripAnalysisService.PILOT_ID;
    public static final String PILOT_NAME = TripAnalysisService.PILOT_NAME;
    public static final double PILOT_RADIUS_METERS = TripAnalysisService.PILOT_RADIUS_METERS;
    public static final int PILOT_MIN_COVERAGE_PCT = TripAnalysisService.PILOT_MIN_COVERAGE_PCT;
    public static final double SAMPLE_LENGTH_METERS = TripAnalysisService.SAMPLE_LENGTH_METERS;
    public static final List<String> PILOT_LOCATION_IDS = TripAnalysisService.PILOT_LOCATION_IDS;

    private final DashboardService dashboard;
    private final TripAnalysisService tripAnalysisService;
    private final GeocodingService geocodingService;
    private final RoutingService routingService;

    public TripAnalyzeController(DashboardService dashboard) {
        this(dashboard, new TripAnalysisService(), new GeocodingService(), new RoutingService());
    }

    @org.springframework.beans.factory.annotation.Autowired
    public TripAnalyzeController(
            DashboardService dashboard,
            TripAnalysisService tripAnalysisService,
            GeocodingService geocodingService,
            RoutingService routingService) {
        this.dashboard = dashboard;
        this.tripAnalysisService = tripAnalysisService;
        this.geocodingService = geocodingService;
        this.routingService = routingService;
    }

    @PostMapping
    public ResponseEntity<Object> analyze(@RequestBody(required = false) Map<String, Object> body) {
        if (body == null) {
            return bad("INVALID_JSON", "Send a valid JSON request body.");
        }

        String origin = clean(body.get("origin"));
        String destination = clean(body.get("destination"));
        boolean preferDemo = Boolean.TRUE.equals(body.get("preferSavedDemo"));

        if (origin.isEmpty() || destination.isEmpty()
                || origin.length() > 160 || destination.length() > 160) {
            return bad("INVALID_TRIP", "Enter an origin and destination of 160 characters or fewer.");
        }
        if (origin.equalsIgnoreCase(destination)) {
            return bad("SAME_LOCATION", "Origin and destination must be different.");
        }

        try {
            List<SafeGoLocation> locations = dashboard.snapshot(false).locations();

            ResolvedPlace originPlace = geocodingService.resolvePlace(origin, locations);
            ResolvedPlace destPlace = geocodingService.resolvePlace(destination, locations);
            RouteResult route = routingService.fetchRoute(originPlace.coordinates(), destPlace.coordinates(), preferDemo);

            TripAnalysis analysis = assessTrip(originPlace, destPlace, route, locations);

            return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(Map.of(
                    "data", analysis,
                    "meta", Map.of("backend", dashboard.backend(), "generatedAt", analysis.generatedAt())
                ));
        } catch (TripError e) {
            return ResponseEntity.status(400)
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(ApiResponse.error(e.code, e.getMessage()));
        } catch (Exception e) {
            String msg = e.getMessage() != null ? e.getMessage() : "The trip could not be analyzed.";
            return ResponseEntity.status(502)
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(ApiResponse.error("TRIP_ANALYSIS_FAILED", msg));
        }
    }

    public TripAnalysis assessTrip(
            ResolvedPlace origin, ResolvedPlace dest, RouteResult route,
            List<SafeGoLocation> locations) {
        List<SourceStatus> sources = dashboard != null ? dashboard.snapshot(false).sources() : List.of();
        return assessTrip(origin, dest, route, locations, sources);
    }

    public TripAnalysis assessTrip(
            ResolvedPlace origin, ResolvedPlace dest, RouteResult route,
            List<SafeGoLocation> locations, List<SourceStatus> sources) {
        return tripAnalysisService.assessTrip(origin, dest, route, locations, sources);
    }

    public static RouteResult savedDemoRoute(double[] origin, double[] dest) {
        return DemoRoutes.savedDemoRoute(origin, dest);
    }

    public static double distanceKm(double[] a, double[] b) {
        return GeoUtils.distanceKm(a, b);
    }

    public static String clean(Object v) {
        return GeoUtils.clean(v);
    }

    public static String normalize(String v) {
        return GeoUtils.normalize(v);
    }

    private static ResponseEntity<Object> bad(String code, String msg) {
        return ResponseEntity.status(400)
            .header(HttpHeaders.CACHE_CONTROL, "no-store")
            .body(ApiResponse.error(code, msg));
    }

    public record RouteResult(double[][] coordinates, List<String> roadNames, String source) {}

    public static class TripError extends RuntimeException {
        public final String code;
        public TripError(String code, String msg) {
            super(msg);
            this.code = code;
        }
    }

    public static class RawSegment extends TripAnalysisService.RawSegment {
        public RawSegment(double[][] coords, Double score, boolean covered,
                          String basisId, String basisName, double lengthMeters, Double nearestDist) {
            super(coords, score, covered, basisId, basisName, lengthMeters, nearestDist);
        }
    }
}
