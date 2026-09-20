package com.safego.demo.model;

import java.util.List;

public record RiskAssessment(
    String key,
    String name,
    String rank,
    int percentage,
    int rawScore,
    String safetyRule,
    List<RiskContribution> contributions,
    String summary,
    String status,
    String modelVersion
) {}
