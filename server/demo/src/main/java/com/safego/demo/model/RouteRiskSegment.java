package com.safego.demo.model;

public record RouteRiskSegment(
    double[][] coordinates,
    Integer riskScore,
    String riskKey,
    String basisLocationId,
    String basisLocationName,
    double lengthMeters,
    String coverage,
    Double nearestPointDistanceMeters
) {}
