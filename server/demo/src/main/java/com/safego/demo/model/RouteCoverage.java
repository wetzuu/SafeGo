package com.safego.demo.model;

public record RouteCoverage(
    String pilotId,
    String status,
    double coveredPercent,
    int minimumPercent,
    double radiusMeters,
    double totalMeters,
    double coveredMeters,
    double unknownMeters,
    double longestUnknownGapMeters
) {}
