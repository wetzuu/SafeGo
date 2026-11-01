package com.safego.demo.data;

import com.safego.demo.model.RiskAssessment;
import com.safego.demo.model.RiskContribution;
import com.safego.demo.model.RiskFactor;

import java.util.List;

/** The weighted five-factor model. Weights, bands and floors come from {@link RiskPolicy}. */
public final class RiskModel {

    private static final RiskPolicy POLICY = RiskPolicy.get();

    public static final String MODEL_VERSION = POLICY.modelVersion();

    private RiskModel() {}

    /** Band key ("low", "mod", "high", "crit") for a 0–100 score. */
    public static String bandKey(int score) {
        return POLICY.band(score).key();
    }

    /** Band name ("LOW RISK" … "CRITICAL RISK") for a 0–100 score. */
    public static String bandName(int score) {
        return POLICY.band(score).name();
    }

    /** Band label ("Low" … "Critical") for a 0–100 score. */
    public static String bandLabel(int score) {
        return POLICY.band(score).label();
    }

    public static RiskAssessment analyzeRisk(List<RiskFactor> factors, String summary, String status) {
        List<RiskContribution> contributions = factors.stream()
            .map(f -> {
                double weight = POLICY.weights().getOrDefault(f.name(), 0.0);
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
        RiskPolicy.Floors floors = POLICY.floors();
        int highMinimum = POLICY.bandMinimum("high");
        int criticalMinimum = POLICY.bandMinimum("crit");

        int percentage = rawScore;
        String safetyRule = "";

        if (floodScore >= floors.floodRoadCritical() && percentage < criticalMinimum) {
            percentage = criticalMinimum;
            safetyRule = "Critical floor applied because the flood / road score is " + floors.floodRoadCritical() + " or higher.";
        } else if (floodScore >= floors.floodRoadHigh() && percentage < highMinimum) {
            percentage = highMinimum;
            safetyRule = "High-risk floor applied because the flood / road score is " + floors.floodRoadHigh() + " or higher.";
        }

        if (weatherScore >= floors.severeWeather() && advisoryScore >= floors.elevatedAdvisory() && percentage < highMinimum) {
            percentage = highMinimum;
            safetyRule = "High-risk floor applied because severe weather is supported by an elevated official advisory.";
        }

        percentage = Math.max(0, Math.min(100, percentage));
        RiskPolicy.Band band = POLICY.band(percentage);

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
