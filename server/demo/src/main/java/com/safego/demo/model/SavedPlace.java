package com.safego.demo.model;

public record SavedPlace(
    String label,
    String canonicalLabel,
    double[] coordinates,
    String source,
    String matchedLocationId,
    boolean approximate
) {}
