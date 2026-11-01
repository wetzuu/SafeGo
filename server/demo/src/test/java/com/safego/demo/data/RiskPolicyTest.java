package com.safego.demo.data;

import com.safego.demo.service.TripAnalysisService;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** The Java side reads every model value from config/risk-policy.json (shared with the web app). */
class RiskPolicyTest {

    private final RiskPolicy policy = RiskPolicy.get();

    @Test
    void policyLoadsAndIsConsistent() {
        assertEquals(1.0, policy.weights().values().stream().mapToDouble(Double::doubleValue).sum(), 1e-9);
        assertEquals(100, policy.bands().get(policy.bands().size() - 1).maximum());
        assertEquals(List.of("low", "mod", "high", "crit"), policy.bands().stream().map(RiskPolicy.Band::key).toList());
    }

    @Test
    void bandEdgesMatchTheDocumentedScale() {
        assertEquals("low", RiskModel.bandKey(29));
        assertEquals("mod", RiskModel.bandKey(30));
        assertEquals("MODERATE RISK", RiskModel.bandName(59));
        assertEquals("High", RiskModel.bandLabel(60));
        assertEquals("crit", RiskModel.bandKey(80));
        assertEquals(60, policy.bandMinimum("high"));
        assertEquals(80, policy.bandMinimum("crit"));
        assertEquals(0, policy.bandMinimum("low"));
    }

    @Test
    void modelAndTripsUseThePolicy() {
        assertEquals(policy.modelVersion(), RiskModel.MODEL_VERSION);
        assertEquals(policy.pilot().id(), TripAnalysisService.PILOT_ID);
        assertEquals(policy.pilot().locationIds(), TripAnalysisService.PILOT_LOCATION_IDS);
        assertEquals(policy.pilot().radiusMeters(), TripAnalysisService.PILOT_RADIUS_METERS, 0.0);
        assertEquals(policy.pilot().minimumCoveragePercent(), TripAnalysisService.PILOT_MIN_COVERAGE_PCT);
        assertEquals(18, TripAnalysisService.PILOT_LOCATION_IDS.size());
    }

    @Test
    void weightsComeFromThePolicy() {
        var result = RiskModel.analyzeRisk(List.of(
            new com.safego.demo.model.RiskFactor("Weather", 100, "crit", "x", "x", "x", "x")), "", "");
        assertEquals((int) Math.round(100 * policy.weights().get("Weather")), result.rawScore());
        assertTrue(result.contributions().get(0).weight() > 0);
    }
}
