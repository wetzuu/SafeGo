package com.safego.demo.model;

public record ResolvedPlace(
    String label,
    double[] coordinates,
    String source,
    String matchedLocationId,
    boolean approximate
) {}
