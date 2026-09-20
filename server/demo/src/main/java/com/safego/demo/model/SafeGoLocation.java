package com.safego.demo.model;

import java.util.List;

public record SafeGoLocation(
    String id,
    String name,
    String city,
    List<String> aliases,
    double[] coordinates,
    String updated,
    String riskSummary,
    String riskStatus,
    List<Stat> stats,
    List<RiskFactor> factors,
    List<Advisory> advisories,
    List<UniversityStatus> universities,
    List<CommunityReport> reports,
    List<RoutePoint> points,
    List<Hazard> floods,
    List<Hazard> hazards,
    RiskAssessment risk
) {}
