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
    List<SourceStatus> sources
) {}
