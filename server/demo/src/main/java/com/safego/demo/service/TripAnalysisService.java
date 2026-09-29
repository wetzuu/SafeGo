package com.safego.demo.service;

import com.safego.demo.api.TripAnalyzeController.RouteResult;
import com.safego.demo.api.TripAnalyzeController.TripError;
import com.safego.demo.model.*;
import com.safego.demo.util.GeoUtils;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class TripAnalysisService {

    public static final String PILOT_ID = "manila-makati-v1";
    public static final String PILOT_NAME = "Manila–Makati–Pasig pilot";
    public static final double PILOT_RADIUS_METERS = 850.0;
    public static final int PILOT_MIN_COVERAGE_PCT = 90;
    public static final double SAMPLE_LENGTH_METERS = 100.0;
    public static final List<String> PILOT_LOCATION_IDS =
        List.of("espana", "lerma", "quiapo", "mapua-makati", "ortigas-pasig");

    public TripAnalysis assessTrip(
            ResolvedPlace origin, ResolvedPlace dest, RouteResult route,
            List<SafeGoLocation> locations, List<SourceStatus> sources) {

        List<SafeGoLocation> pilotLocations = locations.stream()
            .filter(loc -> PILOT_LOCATION_IDS.contains(loc.id()))
            .toList();

        double[][] coords = route.coordinates();
        if (coords == null || coords.length < 2) {
            throw new TripError("TRIP_ANALYSIS_FAILED", "Route needs at least two points.");
        }
        for (double[] pt : coords) {
            if (!GeoUtils.isValidCoordinate(pt)) {
                throw new TripError("TRIP_ANALYSIS_FAILED", "A route with at least two valid coordinates is required.");
            }
        }

        List<double[]> sampled = new ArrayList<>();
        sampled.add(coords[0]);
        for (int i = 1; i < coords.length; i++) {
            double[] start = coords[i - 1];
            double[] end = coords[i];
            int pieces = (int) Math.max(1, Math.ceil(GeoUtils.distanceKm(start, end) * 1000.0 / SAMPLE_LENGTH_METERS));
            if ((sampled.size() + pieces) > 50_000) {
                throw new TripError("TRIP_ANALYSIS_FAILED", "This route is too long for the current pilot.");
            }
            for (int p = 1; p <= pieces; p++) {
                sampled.add(p == pieces ? end : new double[]{
                    start[0] + (end[0] - start[0]) * p / pieces,
                    start[1] + (end[1] - start[1]) * p / pieces
                });
            }
        }

        List<RawSegment> rawSegments = new ArrayList<>();
        double weightedRisk = 0;
        double totalDist = 0;
        double coveredDist = 0;
        double unknownGap = 0;
        double longestGap = 0;
        double maxRisk = 0;

        for (int i = 0; i < sampled.size() - 1; i++) {
            double[] s = sampled.get(i);
            double[] e = sampled.get(i + 1);
            double[] center = {(s[0] + e[0]) / 2, (s[1] + e[1]) / 2};

            SafeGoLocation nearest = null;
            double nearestDist = Double.MAX_VALUE;
            for (SafeGoLocation loc : pilotLocations) {
                double d = GeoUtils.distanceKm(center, loc.coordinates());
                if (d < nearestDist) {
                    nearestDist = d;
                    nearest = loc;
                }
            }

            double segLen = GeoUtils.distanceKm(s, e) * 1000.0;
            boolean covered = nearest != null
                && (GeoUtils.distanceKm(s, nearest.coordinates()) * 1000.0 + segLen) <= PILOT_RADIUS_METERS;

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
                covered && nearest != null ? nearest.id() : null,
                covered && nearest != null ? nearest.name() : null,
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

        if (totalDist < 1) {
            throw new TripError("TRIP_ANALYSIS_FAILED", "Choose two distinct route endpoints.");
        }

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
        Integer calmScore = sufficient ? null : calmAreaScore(pilotLocations, coords);
        boolean calmEstimate = calmScore != null;
        if (calmEstimate) {
            rawScore = calmScore;
            overallScore = calmScore;
        }
        if (overallScore != null && maxRisk >= 80 && overallScore < 80) {
            overallScore = 80;
            safetyRule = "Critical route floor applied because part of the route is covered by a Critical risk point.";
        } else if (overallScore != null && maxRisk >= 60 && overallScore < 60) {
            overallScore = 60;
            safetyRule = "High route floor applied because part of the route is covered by a High risk point.";
        }

        String riskKey;
        String riskName;
        if (overallScore == null) {
            riskKey = "unknown";
            riskName = "INSUFFICIENT COVERAGE";
        } else {
            if (overallScore <= 29) {
                riskKey = "low";
                riskName = "LOW RISK";
            } else if (overallScore <= 59) {
                riskKey = "mod";
                riskName = "MODERATE RISK";
            } else if (overallScore <= 79) {
                riskKey = "high";
                riskName = "HIGH RISK";
            } else {
                riskKey = "crit";
                riskName = "CRITICAL RISK";
            }
        }

        Set<String> basisIds = rawSegments.stream()
            .filter(s -> s.basisId != null)
            .map(s -> s.basisId)
            .collect(Collectors.toSet());

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
            if (seg.score == null) {
                sk = "unknown";
            } else if (seg.score <= 29) {
                sk = "low";
            } else if (seg.score <= 59) {
                sk = "mod";
            } else if (seg.score <= 79) {
                sk = "high";
            } else {
                sk = "crit";
            }
            return new RouteRiskSegment(
                seg.coords, seg.score == null ? null : seg.score.intValue(), sk,
                seg.basisId, seg.basisName,
                seg.lengthMeters, seg.covered ? "covered" : "unknown",
                seg.nearestDist == null ? null : seg.nearestDist
            );
        }).toList();

        String coverageNote = calmEstimate ? String.format(
            Locale.ENGLISH,
            "Only %.1f%% of this route has location-specific data, but weather, flood/road and official advisory signals are all low across the %s. This is an area-wide estimate, not a road-by-road rating; check local conditions before travelling.",
            coverage.coveredPercent(), PILOT_NAME
        ) : String.format(
            Locale.ENGLISH,
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
            coverage, sources
        );
    }

    static final int CALM_FACTOR_MAX_SCORE = 29;
    static final double CALM_AREA_MAX_KM = 15.0;
    private static final Set<String> CALM_FACTORS = Set.of("Weather", "Flood / roads", "Official advisories");

    /**
     * For routes without enough location-specific coverage: if every pilot location shows
     * calm weather, no flood/road issue and no advisory, and the whole route lies in the
     * Metro Manila pilot area, return the highest of those factor scores (a Low rating).
     * Returns null when anything is active or the area cannot be judged.
     */
    static Integer calmAreaScore(List<SafeGoLocation> pilotLocations, double[][] route) {
        if (pilotLocations.isEmpty()) return null;
        for (double[] pt : route) {
            double nearestKm = pilotLocations.stream()
                .mapToDouble(loc -> GeoUtils.distanceKm(pt, loc.coordinates())).min().orElse(Double.MAX_VALUE);
            if (nearestKm > CALM_AREA_MAX_KM) return null;
        }
        int highest = 0;
        for (SafeGoLocation loc : pilotLocations) {
            long found = loc.factors().stream().filter(f -> CALM_FACTORS.contains(f.name())).count();
            if (found < CALM_FACTORS.size()) return null;
            for (RiskFactor f : loc.factors()) {
                if (!CALM_FACTORS.contains(f.name())) continue;
                if (f.score() > CALM_FACTOR_MAX_SCORE) return null;
                highest = Math.max(highest, f.score());
            }
        }
        return highest;
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

    public static class RawSegment {
        public double[][] coords;
        public Double score;
        public boolean covered;
        public String basisId;
        public String basisName;
        public double lengthMeters;
        public Double nearestDist;

        public RawSegment(double[][] coords, Double score, boolean covered,
                          String basisId, String basisName, double lengthMeters, Double nearestDist) {
            this.coords = coords;
            this.score = score;
            this.covered = covered;
            this.basisId = basisId;
            this.basisName = basisName;
            this.lengthMeters = lengthMeters;
            this.nearestDist = nearestDist;
        }

        public RawSegment merge(RawSegment next) {
            double[][] merged = Arrays.copyOf(coords, coords.length + next.coords.length - 1);
            System.arraycopy(next.coords, 1, merged, coords.length, next.coords.length - 1);
            Double maxDist = (nearestDist == null && next.nearestDist == null) ? null
                : nearestDist == null ? next.nearestDist
                : next.nearestDist == null ? nearestDist
                : Math.max(nearestDist, next.nearestDist);
            return new RawSegment(merged, score, covered, basisId, basisName,
                lengthMeters + next.lengthMeters, maxDist);
        }
    }
}
