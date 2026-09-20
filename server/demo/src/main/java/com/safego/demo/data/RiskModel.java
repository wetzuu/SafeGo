package com.safego.demo.data;

import com.safego.demo.model.RiskAssessment;
import com.safego.demo.model.RiskContribution;
import com.safego.demo.model.RiskFactor;

import java.util.List;
import java.util.Map;

public final class RiskModel {

    public static final String MODEL_VERSION = "1.0.0";

    private static final Map<String, Double> WEIGHTS = Map.of(
        "Weather", 0.25,
        "Flood / roads", 0.40,
        "Official advisories", 0.20,
        "School status", 0.05,
        "Community reports", 0.10
    );

    private record Band(int maximum, String key, String name, String rank) {}

    private static final List<Band> BANDS = List.of(
        new Band(29,  "low",  "LOW RISK",      "Level 1 of 4"),
        new Band(59,  "mod",  "MODERATE RISK", "Level 2 of 4"),
        new Band(79,  "high", "HIGH RISK",      "Level 3 of 4"),
        new Band(100, "crit", "CRITICAL RISK",  "Level 4 of 4")
    );

    private RiskModel() {}

    public static RiskAssessment analyzeRisk(List<RiskFactor> factors, String summary, String status) {
        List<RiskContribution> contributions = factors.stream()
            .map(f -> {
                double weight = WEIGHTS.getOrDefault(f.name(), 0.0);
                double points = f.score() * weight;
                return new RiskContribution(f.name(), f.score(), weight, points);
            })
            .toList();

        int rawScore = (int) Math.round(
            contributions.stream().mapToDouble(RiskContribution::points).sum()
        );

        int floodScore  = scoreFor(factors, "Flood / roads");
        int weatherScore = scoreFor(factors, "Weather");
        int advisoryScore = scoreFor(factors, "Official advisories");

        int percentage = rawScore;
        String safetyRule = "";

        if (floodScore >= 85 && percentage < 80) {
            percentage = 80;
            safetyRule = "Critical floor applied because the flood / road score is 85 or higher.";
        } else if (floodScore >= 70 && percentage < 60) {
            percentage = 60;
            safetyRule = "High-risk floor applied because the flood / road score is 70 or higher.";
        }

        if (weatherScore >= 85 && advisoryScore >= 70 && percentage < 60) {
            percentage = 60;
            safetyRule = "High-risk floor applied because severe weather is supported by an elevated official advisory.";
        }

        percentage = Math.max(0, Math.min(100, percentage));

        final int finalPercentage = percentage;
        Band band = BANDS.stream()
            .filter(b -> finalPercentage <= b.maximum())
            .findFirst()
            .orElse(BANDS.get(BANDS.size() - 1));

        return new RiskAssessment(
            band.key(), band.name(), band.rank(),
            percentage, rawScore, safetyRule,
            contributions, summary, status, MODEL_VERSION
        );
    }

    private static int scoreFor(List<RiskFactor> factors, String name) {
        return factors.stream()
            .filter(f -> f.name().equals(name))
            .mapToInt(RiskFactor::score)
            .findFirst()
            .orElse(0);
    }
}
