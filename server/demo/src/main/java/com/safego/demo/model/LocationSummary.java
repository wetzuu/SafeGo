package com.safego.demo.model;

import java.util.List;

public record LocationSummary(
    String id,
    String name,
    String city,
    List<String> aliases,
    double[] coordinates,
    String updated,
    RiskSummary risk
) {
    public record RiskSummary(
        String key,
        String name,
        String rank,
        int percentage,
        String modelVersion
    ) {}
}
