package com.safego.demo.model;

import java.util.List;

/**
 * A rating and how it was reached.
 *
 * @param basis          "full" (every factor has a live source, weighted model), "partial" (only some
 *                       factors are live, so the score is the highest live factor) or "none" (not rated).
 * @param countedFactors the factor names that count toward this rating.
 */
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
    String modelVersion,
    String basis,
    List<String> countedFactors
) {
    /** The weighted model's result before live sources are checked: every factor counts. */
    public RiskAssessment(String key, String name, String rank, int percentage, int rawScore, String safetyRule,
            List<RiskContribution> contributions, String summary, String status, String modelVersion) {
        this(key, name, rank, percentage, rawScore, safetyRule, contributions, summary, status, modelVersion,
            "full", contributions.stream().map(RiskContribution::name).toList());
    }
}
