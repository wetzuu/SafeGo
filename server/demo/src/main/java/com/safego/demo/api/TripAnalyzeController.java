package com.safego.demo.api;

import com.safego.demo.data.MockRepository;
import com.safego.demo.model.*;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

import com.fasterxml.jackson.databind.ObjectMapper;

@RestController
@RequestMapping("/api/trips/analyze")
public class TripAnalyzeController {

    private static final String PILOT_ID = "manila-makati-v1";
    private static final String PILOT_NAME = "Manila–Makati pilot";
    private static final double PILOT_RADIUS_METERS = 850.0;
    private static final int PILOT_MIN_COVERAGE_PCT = 90;
    private static final double SAMPLE_LENGTH_METERS = 100.0;
    private static final List<String> PILOT_LOCATION_IDS =
        List.of("espana", "lerma", "quiapo", "mapua-makati");

    private static final double[] ESPANA_COORD = {14.612, 120.9902};
    private static final double[] LERMA_COORD = {14.6049, 120.9888};
    private static final double[][] ESPANA_TO_LERMA = {
        {14.612167,120.990381},{14.611941,120.990603},{14.611887,120.990655},
        {14.611788,120.990755},{14.611396,120.991132},{14.611344,120.991183},
        {14.610699,120.991798},{14.610463,120.992028},{14.61003,120.992445},
        {14.609809,120.992658},{14.609731,120.992738},{14.609648,120.992821},
        {14.609593,120.992872},{14.609105,120.993325},{14.608999,120.993307},
        {14.608912,120.993303},{14.608099,120.993278},{14.608011,120.993275},
        {14.607935,120.993192},{14.607909,120.993165},{14.607701,120.992934},
        {14.607513,120.992723},{14.607254,120.992434},{14.607011,120.992172},
        {14.606766,120.991909},{14.606734,120.991872},{14.606524,120.991637},
        {14.606314,120.991404},{14.606038,120.991097},{14.605542,120.990557},
        {14.605282,120.990275},{14.605052,120.990016},{14.604856,120.989801},
        {14.60472,120.989649},{14.604575,120.989481},{14.605074,120.988988}
    };
    private static final List<String> DEMO_ROAD_NAMES =
        List.of("A. H. Lacson Avenue", "M. Earnshaw Street", "S. H. Loyola Street", "Padre Campa Street");

    private static final String OSRM_BASE = "https://router.project-osrm.org";
    private static final String NOMINATIM_BASE = "https://nominatim.openstreetmap.org/search";
    private static final long ROUTE_CACHE_MS = 10 * 60 * 1_000L;
    private static final long GEO_CACHE_MS = 24 * 60 * 60 * 1_000L;

    private static final ConcurrentHashMap<String, TimedValue<RouteResult>> routeCache = new ConcurrentHashMap<>();
    private static final ConcurrentHashMap<String, TimedValue<ResolvedPlace>> geoCache = new ConcurrentHashMap<>();

    private static final HttpClient HTTP = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(12))
        .build();
    private static final ObjectMapper MAPPER = new ObjectMapper();

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
            List<SafeGoLocation> locations = MockRepository.listDashboardLocations();

            ResolvedPlace originPlace = resolvePlace(origin, locations);
            ResolvedPlace destPlace = resolvePlace(destination, locations);
            RouteResult route = fetchRoute(originPlace.coordinates(), destPlace.coordinates(), preferDemo);

            TripAnalysis analysis = assessTrip(originPlace, destPlace, route, locations);

            return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(Map.of(
                    "data", analysis,
                    "meta", Map.of("backend", "mock", "generatedAt", analysis.generatedAt())
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

    private static ResolvedPlace resolvePlace(String query, List<SafeGoLocation> locations)
            throws Exception {
        String target = normalize(query);
        Optional<SafeGoLocation> preset = locations.stream().filter(loc -> {
            List<String> candidates = new ArrayList<>();
            candidates.add(loc.id());
            candidates.add(loc.name());
            candidates.addAll(loc.aliases());
            return candidates.stream().anyMatch(candidate -> {
                String norm = normalize(candidate);
                return norm.equals(target)
                    || (norm.contains(" ") && norm.length() >= 8 && target.contains(norm));
            });
        }).findFirst();

        if (preset.isPresent()) {
            SafeGoLocation loc = preset.get();
            return new ResolvedPlace(loc.name(), loc.coordinates(), "preset", loc.id(), true);
        }

        TimedValue<ResolvedPlace> cached = geoCache.get(target);
        if (cached != null && cached.expiresAt > System.currentTimeMillis()) return cached.value;

        ResolvedPlace place = queryNominatim(query);
        geoCache.put(target, new TimedValue<>(place, System.currentTimeMillis() + GEO_CACHE_MS));
        return place;
    }

    private static ResolvedPlace queryNominatim(String query) throws Exception {
        String url = NOMINATIM_BASE + "?q=" + URLEncoder.encode(query, StandardCharsets.UTF_8)
            + "&format=jsonv2&limit=1&countrycodes=ph&addressdetails=0";
        String contact = System.getenv("SAFEGO_CONTACT_EMAIL");
        String ua = "SafeGo-Prototype/0.1 " + (contact != null ? "(" + contact + ")" : "(local development)");

        HttpRequest req = HttpRequest.newBuilder(URI.create(url))
            .timeout(Duration.ofSeconds(10))
            .header("Accept", "application/json")
            .header("Accept-Language", "en")
            .header("User-Agent", ua)
            .GET()
            .build();

        HttpResponse<String> resp = HTTP.send(req, HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() != 200) {
            throw new Exception("Geocoding service returned HTTP " + resp.statusCode() + ".");
        }

        List<?> results = MAPPER.readValue(resp.body(), List.class);
        if (results.isEmpty()) {
            throw new Exception("No Philippine location found for \"" + query + "\".");
        }
        Map<?, ?> first = (Map<?, ?>) results.get(0);
        double lat = Double.parseDouble((String) first.get("lat"));
        double lon = Double.parseDouble((String) first.get("lon"));
        String label = (String) first.get("display_name");
        return new ResolvedPlace(label, new double[]{lat, lon}, "nominatim", null, true);
    }

    private static RouteResult fetchRoute(double[] origin, double[] dest, boolean preferDemo)
            throws Exception {
        String base = System.getenv("SAFEGO_ROUTING_BASE_URL");
        if (base == null) base = OSRM_BASE;
        boolean fallbackEnabled = !"false".equals(System.getenv("SAFEGO_DEMO_ROUTE_FALLBACK"));

        if (fallbackEnabled && preferDemo) {
            RouteResult demo = savedDemoRoute(origin, dest);
            if (demo != null) return demo;
        }

        String key = base + ":" + origin[1] + "," + origin[0] + ";" + dest[1] + "," + dest[0];
        TimedValue<RouteResult> cached = routeCache.get(key);
        if (cached != null && cached.expiresAt > System.currentTimeMillis()) return cached.value;

        try {
            RouteResult route = queryOsrm(base, origin, dest);
            routeCache.put(key, new TimedValue<>(route, System.currentTimeMillis() + ROUTE_CACHE_MS));
            return route;
        } catch (Exception e) {
            if (fallbackEnabled) {
                RouteResult demo = savedDemoRoute(origin, dest);
                if (demo != null) return demo;
            }
            throw e;
        }
    }

    @SuppressWarnings("unchecked")
    private static RouteResult queryOsrm(String base, double[] origin, double[] dest) throws Exception {
        String coords = dest[1] + "," + dest[0];
        String url = base + "/route/v1/driving/"
            + origin[1] + "," + origin[0] + ";" + coords
            + "?alternatives=false&steps=true&geometries=geojson&overview=full";

        HttpRequest req = HttpRequest.newBuilder(URI.create(url))
            .timeout(Duration.ofSeconds(12))
            .GET().build();

        HttpResponse<String> resp = HTTP.send(req, HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() != 200) {
            throw new Exception("Routing service returned HTTP " + resp.statusCode() + ".");
        }

        Map<String, Object> payload = MAPPER.readValue(resp.body(), Map.class);
        if (!"Ok".equals(payload.get("code"))) {
            String msg = (String) payload.getOrDefault("message", "No drivable route was found.");
            throw new Exception(msg);
        }

        List<Map<String, Object>> routes = (List<Map<String, Object>>) payload.get("routes");
        if (routes == null || routes.isEmpty()) throw new Exception("No drivable route was found.");

        Map<String, Object> route = routes.get(0);
        Map<String, Object> geometry = (Map<String, Object>) route.get("geometry");
        List<List<Double>> rawCoords = (List<List<Double>>) geometry.get("coordinates");

        double[][] routeCoords = rawCoords.stream()
            .map(c -> new double[]{c.get(1), c.get(0)})
            .toArray(double[][]::new);

        List<Map<String, Object>> legs = (List<Map<String, Object>>) route.get("legs");
        List<String> roadNames = new ArrayList<>();
        if (legs != null) {
            for (Map<String, Object> leg : legs) {
                List<Map<String, Object>> steps = (List<Map<String, Object>>) leg.get("steps");
                if (steps != null) {
                    for (Map<String, Object> step : steps) {
                        String name = (String) step.get("name");
                        if (name != null && !name.isBlank() && !roadNames.contains(name)) {
                            roadNames.add(name.trim());
                            if (roadNames.size() >= 8) break;
                        }
                    }
                }
                if (roadNames.size() >= 8) break;
            }
        }

        return new RouteResult(routeCoords, roadNames, "osrm");
    }

    private static RouteResult savedDemoRoute(double[] origin, double[] dest) {
        if (samePoint(origin, ESPANA_COORD) && samePoint(dest, LERMA_COORD)) {
            return new RouteResult(ESPANA_TO_LERMA.clone(), DEMO_ROAD_NAMES, "saved-demo");
        }
        if (samePoint(origin, LERMA_COORD) && samePoint(dest, ESPANA_COORD)) {
            double[][] reversed = new double[ESPANA_TO_LERMA.length][];
            for (int i = 0; i < ESPANA_TO_LERMA.length; i++)
                reversed[i] = ESPANA_TO_LERMA[ESPANA_TO_LERMA.length - 1 - i];
            return new RouteResult(reversed, DEMO_ROAD_NAMES, "saved-demo");
        }
        return null;
    }

    private static boolean samePoint(double[] a, double[] b) {
        return Math.abs(a[0] - b[0]) < 0.000001 && Math.abs(a[1] - b[1]) < 0.000001;
    }

    private TripAnalysis assessTrip(
            ResolvedPlace origin, ResolvedPlace dest, RouteResult route,
            List<SafeGoLocation> locations) {

        List<SafeGoLocation> pilotLocations = locations.stream()
            .filter(loc -> PILOT_LOCATION_IDS.contains(loc.id()))
            .toList();

        double[][] coords = route.coordinates();
        if (coords.length < 2) throw new TripError("TRIP_ANALYSIS_FAILED", "Route needs at least two points.");

        List<double[]> sampled = new ArrayList<>();
        sampled.add(coords[0]);
        for (int i = 1; i < coords.length; i++) {
            double[] start = coords[i - 1], end = coords[i];
            int pieces = (int) Math.max(1, Math.ceil(distanceKm(start, end) * 1000.0 / SAMPLE_LENGTH_METERS));
            if ((sampled.size() + pieces) > 50_000) throw new TripError("TRIP_ANALYSIS_FAILED", "This route is too long for the current pilot.");
            for (int p = 1; p <= pieces; p++) {
                sampled.add(p == pieces ? end : new double[]{
                    start[0] + (end[0] - start[0]) * p / pieces,
                    start[1] + (end[1] - start[1]) * p / pieces
                });
            }
        }

        List<RawSegment> rawSegments = new ArrayList<>();
        double weightedRisk = 0, totalDist = 0, coveredDist = 0, unknownGap = 0, longestGap = 0, maxRisk = 0;

        for (int i = 0; i < sampled.size() - 1; i++) {
            double[] s = sampled.get(i), e = sampled.get(i + 1);
            double[] center = {(s[0] + e[0]) / 2, (s[1] + e[1]) / 2};

            SafeGoLocation nearest = null;
            double nearestDist = Double.MAX_VALUE;
            for (SafeGoLocation loc : pilotLocations) {
                double d = distanceKm(center, loc.coordinates());
                if (d < nearestDist) { nearestDist = d; nearest = loc; }
            }

            double segLen = distanceKm(s, e) * 1000.0;
            boolean covered = nearest != null
                && (distanceKm(s, nearest.coordinates()) * 1000.0 + segLen) <= PILOT_RADIUS_METERS;

            Double score = covered ? (double) nearest.risk().percentage() : null;
            totalDist += segLen;

            if (score != null) {
                coveredDist += segLen;
                weightedRisk += score * segLen;
                maxRisk = Math.max(maxRisk, score);
                unknownGap = 0;
            } else {
                unknownGap += segLen;
                longestGap = Math.max(longestGap, unknownGap);
            }

            RawSegment seg = new RawSegment(
                new double[][]{s, e}, score, covered,
                nearest != null ? nearest.id() : null,
                nearest != null ? nearest.name() : null,
                segLen, nearest != null ? nearestDist * 1000.0 : null
            );

            if (!rawSegments.isEmpty()) {
                RawSegment prev = rawSegments.get(rawSegments.size() - 1);
                if (Objects.equals(prev.basisId, seg.basisId) && Objects.equals(prev.score, seg.score)) {
                    rawSegments.set(rawSegments.size() - 1, prev.merge(seg));
                    continue;
                }
            }
            rawSegments.add(seg);
        }

        if (totalDist < 1) throw new TripError("TRIP_ANALYSIS_FAILED", "Choose two distinct route endpoints.");

        double ratio = coveredDist / totalDist;
        boolean sufficient = ratio * 100 >= PILOT_MIN_COVERAGE_PCT;

        RouteCoverage coverage = new RouteCoverage(
            PILOT_ID, sufficient ? "sufficient" : "insufficient",
            Math.floor(ratio * 1000.0) / 10.0,
            PILOT_MIN_COVERAGE_PCT, PILOT_RADIUS_METERS,
            totalDist, coveredDist, totalDist - coveredDist, longestGap
        );

        Integer rawScore = sufficient ? (int) Math.round(weightedRisk / coveredDist) : null;
        Integer overallScore = rawScore;
        String safetyRule = "";
        if (overallScore != null && maxRisk >= 80 && overallScore < 80) {
            overallScore = 80;
            safetyRule = "Critical route floor applied because part of the route is covered by a Critical risk point.";
        } else if (overallScore != null && maxRisk >= 60 && overallScore < 60) {
            overallScore = 60;
            safetyRule = "High route floor applied because part of the route is covered by a High risk point.";
        }

        String riskKey, riskName;
        if (overallScore == null) {
            riskKey = "unknown"; riskName = "INSUFFICIENT COVERAGE";
        } else {
            if (overallScore <= 29) { riskKey = "low"; riskName = "LOW RISK"; }
            else if (overallScore <= 59) { riskKey = "mod"; riskName = "MODERATE RISK"; }
            else if (overallScore <= 79) { riskKey = "high"; riskName = "HIGH RISK"; }
            else { riskKey = "crit"; riskName = "CRITICAL RISK"; }
        }

        Set<String> basisIds = rawSegments.stream()
            .filter(s -> s.basisId != null).map(s -> s.basisId).collect(Collectors.toSet());
        List<SafeGoLocation> corridorLocations = locations.stream()
            .filter(loc -> basisIds.contains(loc.id()))
            .sorted(Comparator.comparingInt(loc -> -loc.risk().percentage()))
            .toList();

        List<Advisory> advisories = dedupeAdvisories(
            corridorLocations.stream().flatMap(loc -> loc.advisories().stream()).toList());
        List<CommunityReport> reports = dedupeReports(
            corridorLocations.stream().flatMap(loc -> loc.reports().stream()).toList());
        List<Hazard> hazards = dedupeHazards(
            corridorLocations.stream().flatMap(loc -> loc.hazards().stream()).toList());

        List<RouteRiskSegment> segments = rawSegments.stream().map(seg -> {
            String sk;
            if (seg.score == null) { sk = "unknown"; }
            else if (seg.score <= 29) { sk = "low"; }
            else if (seg.score <= 59) { sk = "mod"; }
            else if (seg.score <= 79) { sk = "high"; }
            else { sk = "crit"; }
            return new RouteRiskSegment(
                seg.coords, seg.score == null ? null : seg.score.intValue(), sk,
                seg.basisId, seg.basisName,
                seg.lengthMeters, seg.covered ? "covered" : "unknown",
                seg.nearestDist == null ? null : seg.nearestDist
            );
        }).toList();

        String coverageNote = String.format(
            "%.1f%% of this route is within the %s coverage estimate. A rating requires at least %d%% coverage within %.0f meters of a pilot point. Gray sections have insufficient information; coverage does not establish that the underlying data is current or verified.",
            coverage.coveredPercent(), PILOT_NAME, PILOT_MIN_COVERAGE_PCT, PILOT_RADIUS_METERS
        );

        return new TripAnalysis(
            origin, dest,
            Arrays.stream(route.coordinates()).map(c -> new double[]{c[0], c[1]}).toArray(double[][]::new),
            route.roadNames(), segments,
            overallScore, rawScore, riskKey, riskName, safetyRule,
            corridorLocations, advisories, reports, hazards,
            coverageNote, Instant.now().toString(), route.source(),
            coverage, MockRepository.listSourceStatuses()
        );
    }

    private static double distanceKm(double[] a, double[] b) {
        double R = 6371.0;
        double dLat = Math.toRadians(b[0] - a[0]);
        double dLon = Math.toRadians(b[1] - a[1]);
        double sinLat = Math.sin(dLat / 2), sinLon = Math.sin(dLon / 2);
        double v = sinLat * sinLat
            + Math.cos(Math.toRadians(a[0])) * Math.cos(Math.toRadians(b[0])) * sinLon * sinLon;
        return R * 2 * Math.atan2(Math.sqrt(v), Math.sqrt(1 - v));
    }

    private static List<Advisory> dedupeAdvisories(List<Advisory> items) {
        Map<String, Advisory> seen = new LinkedHashMap<>();
        for (Advisory a : items) seen.putIfAbsent(a.source() + "-" + a.title(), a);
        return List.copyOf(seen.values());
    }

    private static List<CommunityReport> dedupeReports(List<CommunityReport> items) {
        Map<String, CommunityReport> seen = new LinkedHashMap<>();
        for (CommunityReport r : items) seen.putIfAbsent(r.type() + "-" + r.title() + "-" + r.meta(), r);
        return List.copyOf(seen.values());
    }

    private static List<Hazard> dedupeHazards(List<Hazard> items) {
        Map<String, Hazard> seen = new LinkedHashMap<>();
        for (Hazard h : items) seen.putIfAbsent(h.title() + "-" + h.meta(), h);
        return List.copyOf(seen.values());
    }

    private static String clean(Object v) {
        return (v instanceof String s) ? s.replaceAll("\\s+", " ").trim() : "";
    }

    private static String normalize(String v) {
        return v.toLowerCase()
            .replaceAll("[^a-z0-9]+", " ")
            .trim();
    }

    private static ResponseEntity<Object> bad(String code, String msg) {
        return ResponseEntity.status(400)
            .header(HttpHeaders.CACHE_CONTROL, "no-store")
            .body(ApiResponse.error(code, msg));
    }

    private static class TripError extends RuntimeException {
        final String code;
        TripError(String code, String msg) { super(msg); this.code = code; }
    }

    private record TimedValue<T>(T value, long expiresAt) {}

    private record RouteResult(double[][] coordinates, List<String> roadNames, String source) {}

    private static class RawSegment {
        double[][] coords;
        Double score;
        boolean covered;
        String basisId;
        String basisName;
        double lengthMeters;
        Double nearestDist;

        RawSegment(double[][] coords, Double score, boolean covered,
                   String basisId, String basisName, double lengthMeters, Double nearestDist) {
            this.coords = coords; this.score = score; this.covered = covered;
            this.basisId = basisId; this.basisName = basisName;
            this.lengthMeters = lengthMeters; this.nearestDist = nearestDist;
        }

        RawSegment merge(RawSegment next) {
            double[][] merged = Arrays.copyOf(coords, coords.length + next.coords.length - 1);
            System.arraycopy(next.coords, 1, merged, coords.length, next.coords.length - 1);
            double maxDist = (nearestDist == null && next.nearestDist == null) ? 0
                : nearestDist == null ? next.nearestDist
                : next.nearestDist == null ? nearestDist
                : Math.max(nearestDist, next.nearestDist);
            return new RawSegment(merged, score, covered, basisId, basisName,
                lengthMeters + next.lengthMeters, maxDist);
        }
    }
}
