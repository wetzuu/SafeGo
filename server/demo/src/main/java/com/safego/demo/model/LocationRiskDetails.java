package com.safego.demo.model;

import java.util.List;

public record LocationRiskDetails(
    LocationSummary location,
    RiskAssessment assessment,
    List<RiskFactor> factors,
    List<Advisory> advisories,
    List<CommunityReport> communityReports
) {}
