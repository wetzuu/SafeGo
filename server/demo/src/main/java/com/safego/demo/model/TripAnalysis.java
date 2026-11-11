package com.safego.demo.model;

import java.util.List;

public record TripAnalysis(
    ResolvedPlace origin,
    ResolvedPlace destination,
    double[][] routeCoordinates,
    List<String> roadNames,
    List<RouteRiskSegment> segments,
    Integer overallRiskScore,
    Integer rawRiskScore,
    String riskKey,
    String riskName,
    String safetyRule,
    List<SafeGoLocation> corridorLocations,
    List<Advisory> advisories,
    List<CommunityReport> reports,
    List<Hazard> hazards,
    String coverageNote,
    String generatedAt,
    String routingSource,
    RouteCoverage coverage,
    List<SourceStatus> sources,
    /** "route-1" for the main route; alternatives are "route-2", "route-3"… */
    String routeId,
    /** OSRM free-flow driving time (no traffic or flooding); null when the router did not say. */
    Double durationSeconds,
    Double distanceMeters,
    /** Other road routes between the same places, for comparison. Empty when OSRM found none. */
    List<RouteOption> alternatives
) {
    /** The single-route shape used before route comparison: no time, distance or alternatives. */
    public TripAnalysis(ResolvedPlace origin, ResolvedPlace destination, double[][] routeCoordinates,
            List<String> roadNames, List<RouteRiskSegment> segments, Integer overallRiskScore, Integer rawRiskScore,
            String riskKey, String riskName, String safetyRule, List<SafeGoLocation> corridorLocations,
            List<Advisory> advisories, List<CommunityReport> reports, List<Hazard> hazards, String coverageNote,
            String generatedAt, String routingSource, RouteCoverage coverage, List<SourceStatus> sources) {
        this(origin, destination, routeCoordinates, roadNames, segments, overallRiskScore, rawRiskScore, riskKey,
            riskName, safetyRule, corridorLocations, advisories, reports, hazards, coverageNote, generatedAt,
            routingSource, coverage, sources, "route-1", null, null, List.of());
    }

    /** The same analysis with the alternative routes OSRM returned alongside it. */
    public TripAnalysis withAlternatives(List<RouteOption> options) {
        return new TripAnalysis(origin, destination, routeCoordinates, roadNames, segments, overallRiskScore,
            rawRiskScore, riskKey, riskName, safetyRule, corridorLocations, advisories, reports, hazards, coverageNote,
            generatedAt, routingSource, coverage, sources, routeId, durationSeconds, distanceMeters, List.copyOf(options));
    }
}
