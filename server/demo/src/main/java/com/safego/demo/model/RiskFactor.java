package com.safego.demo.model;

public record RiskFactor(
    String name,
    int score,
    String pill,
    String pillText,
    String description,
    String icon,
    String tone
) {}
