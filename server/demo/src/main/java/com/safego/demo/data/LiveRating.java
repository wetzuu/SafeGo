package com.safego.demo.data;

import com.safego.demo.model.RiskAssessment;
import com.safego.demo.model.RiskFactor;
import com.safego.demo.model.SafeGoLocation;
import com.safego.demo.model.SourceStatus;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Rescores locations from the factors that have a live source right now, so a missing source never
 * moves a score. Mirrors lib/safego/honest-risk.ts, which the browser applies as well:
 * - every factor live: the weighted model's rating, unchanged (basis "full");
 * - some live: the highest live factor, the same rule as map areas (basis "partial");
 * - none live: not rated (basis "none").
 * With no flood/road feed connected, a live rating is therefore weather plus PAGASA alerts.
 */
public final class LiveRating {

    private LiveRating() {}

    /** Factor names backed by an active source. Community and university data need the database. */
    public static Set<String> liveFactors(List<SourceStatus> sources, String backend) {
        Set<String> live = new LinkedHashSet<>();
        if (active(sources, "open-meteo")) live.add("Weather");
        if (active(sources, "pagasa-cap", "official-advisories")) live.add("Official advisories");
        if (active(sources, "flood-road")) live.add("Flood / roads");
        if ("database".equals(backend)) {
            live.add("Community reports");
            live.add("School status");
        }
        return live;
    }

    public static List<SafeGoLocation> applyAll(List<SafeGoLocation> locations, Set<String> live, boolean replay) {
        return locations.stream().map(location -> apply(location, live, replay)).toList();
    }

    public static SafeGoLocation apply(SafeGoLocation location, Set<String> live, boolean replay) {
        RiskAssessment risk = location.risk();
        List<RiskFactor> counted = location.factors().stream().filter(f -> live.contains(f.name())).toList();
        List<String> countedNames = counted.stream().map(RiskFactor::name).toList();
        String liveWord = replay ? "recorded" : "live";

        RiskAssessment rescored;
        if (counted.size() == location.factors().size()) {
            rescored = new RiskAssessment(risk.key(), risk.name(), risk.rank(), risk.percentage(), risk.rawScore(),
                risk.safetyRule(), risk.contributions(), risk.summary(), risk.status(), risk.modelVersion(),
                "full", countedNames);
        } else if (counted.isEmpty()) {
            rescored = new RiskAssessment(risk.key(), "NOT RATED", "Not rated", 0, 0, "", List.of(),
                "Not rated: no " + liveWord + " data is available for this location right now. Not rated does not mean safe.",
                risk.status(), risk.modelVersion(), "none", countedNames);
        } else {
            int score = counted.stream().mapToInt(RiskFactor::score).max().orElse(0);
            rescored = new RiskAssessment(RiskModel.bandKey(score), RiskModel.bandName(score), "Partial", score, score,
                // The model's safety floors depend on flood and advisory combinations a partial score cannot see.
                "",
                risk.contributions().stream().filter(c -> live.contains(c.name())).toList(),
                "Based on " + liveWord + " " + listNames(countedNames) + ".",
                risk.status(), risk.modelVersion(), "partial", countedNames);
        }
        return new SafeGoLocation(location.id(), location.name(), location.city(), location.aliases(),
            location.coordinates(), location.updated(), location.riskSummary(), location.riskStatus(), location.stats(),
            location.factors(), location.advisories(), location.universities(), location.reports(), location.points(),
            location.floods(), location.hazards(), rescored);
    }

    private static boolean active(List<SourceStatus> sources, String... keys) {
        return sources.stream().anyMatch(s -> "active".equals(s.status()) && List.of(keys).contains(s.key()));
    }

    private static String listNames(List<String> names) {
        List<String> labels = names.stream().map(name -> switch (name) {
            case "Official advisories" -> "official alerts";
            case "School status" -> "university status";
            case "Flood / roads" -> "flood and road conditions";
            default -> name.toLowerCase(java.util.Locale.ROOT);
        }).toList();
        if (labels.size() <= 1) return String.join("", labels);
        return String.join(", ", labels.subList(0, labels.size() - 1)) + " and " + labels.get(labels.size() - 1);
    }
}
