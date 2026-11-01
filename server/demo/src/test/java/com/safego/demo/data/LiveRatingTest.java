package com.safego.demo.data;

import com.safego.demo.model.RiskFactor;
import com.safego.demo.model.SafeGoLocation;
import com.safego.demo.model.SourceStatus;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LiveRatingTest {

    private static RiskFactor factor(String name, int score) {
        return new RiskFactor(name, score, "low", "x", "x", "x", "x");
    }

    /** A place in a storm: severe weather and a PAGASA alert, nothing else connected. */
    private static SafeGoLocation stormyPlace() {
        List<RiskFactor> factors = List.of(
            factor("Weather", 90), factor("Flood / roads", 0), factor("Official advisories", 45),
            factor("School status", 0), factor("Community reports", 0));
        return new SafeGoLocation("espana", "España", "Manila", List.of(), new double[] {14.6, 121.0}, "now", "", "",
            List.of(), factors, List.of(), List.of(), List.of(), List.of(), List.of(), List.of(),
            RiskModel.analyzeRisk(factors, "", ""));
    }

    private static SourceStatus source(String key, String status) {
        return new SourceStatus(key, key, "x", status, null, null, null);
    }

    @Test
    void weightedModelAloneUnderstatesAStorm() {
        // 90 x 0.25 + 45 x 0.20 = 31.5: the reason live ratings must not use the weighted model.
        assertEquals(32, stormyPlace().risk().percentage());
        assertEquals("full", stormyPlace().risk().basis());
    }

    @Test
    void liveFactorsFollowActiveSources() {
        Set<String> live = LiveRating.liveFactors(List.of(
            source("open-meteo", "active"), source("pagasa-cap", "active"),
            source("flood-road", "disabled"), source("official-advisories", "disabled")), "local");
        assertEquals(Set.of("Weather", "Official advisories"), live);
        assertTrue(LiveRating.liveFactors(List.of(), "database").containsAll(Set.of("Community reports", "School status")));
    }

    @Test
    void partialRatingIsTheHighestLiveFactor() {
        SafeGoLocation rated = LiveRating.apply(stormyPlace(), Set.of("Weather", "Official advisories"), false);
        assertEquals("partial", rated.risk().basis());
        assertEquals(List.of("Weather", "Official advisories"), rated.risk().countedFactors());
        assertEquals(90, rated.risk().percentage());
        assertEquals("crit", rated.risk().key());
        assertEquals("Partial", rated.risk().rank());
        assertEquals("", rated.risk().safetyRule());
        assertEquals("Based on live weather and official alerts.", rated.risk().summary());
        assertEquals(2, rated.risk().contributions().size());
    }

    @Test
    void noLiveFactorMeansNotRated() {
        SafeGoLocation rated = LiveRating.apply(stormyPlace(), Set.of(), true);
        assertEquals("none", rated.risk().basis());
        assertEquals(0, rated.risk().percentage());
        assertEquals("NOT RATED", rated.risk().name());
        assertTrue(rated.risk().summary().contains("no recorded data"));
        assertTrue(rated.risk().summary().contains("does not mean safe"));
    }

    @Test
    void everyFactorLiveKeepsTheWeightedModel() {
        Set<String> all = Set.of("Weather", "Flood / roads", "Official advisories", "School status", "Community reports");
        SafeGoLocation rated = LiveRating.apply(stormyPlace(), all, false);
        assertEquals("full", rated.risk().basis());
        assertEquals(32, rated.risk().percentage());
        assertEquals(5, rated.risk().countedFactors().size());
    }
}
