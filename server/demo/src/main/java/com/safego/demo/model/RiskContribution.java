package com.safego.demo.model;

public record RiskContribution(
    String name,
    int score,
    double weight,
    double points
) {}
