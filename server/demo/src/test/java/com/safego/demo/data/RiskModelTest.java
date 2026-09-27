package com.safego.demo.data;

import com.safego.demo.model.RiskAssessment;
import com.safego.demo.model.RiskFactor;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class RiskModelTest {

    private static final List<String> FACTOR_NAMES = List.of(
        "Weather",
        "Flood / roads",
        "Official advisories",
        "School status",
        "Community reports"
    );

    private static List<RiskFactor> factors(int weather, int flood, int advisories, int school, int reports) {
        int[] scores = {weather, flood, advisories, school, reports};
        return List.of(
            new RiskFactor(FACTOR_NAMES.get(0), scores[0], "low", "Test", "Test input", "weather", "icon-weather"),
            new RiskFactor(FACTOR_NAMES.get(1), scores[1], "low", "Test", "Test input", "weather", "icon-weather"),
            new RiskFactor(FACTOR_NAMES.get(2), scores[2], "low", "Test", "Test input", "weather", "icon-weather"),
            new RiskFactor(FACTOR_NAMES.get(3), scores[3], "low", "Test", "Test input", "weather", "icon-weather"),
            new RiskFactor(FACTOR_NAMES.get(4), scores[4], "low", "Test", "Test input", "weather", "icon-weather")
        );
    }

    @Test
    void calculatesTheWeightedEspanaExample() {
        RiskAssessment result = RiskModel.analyzeRisk(factors(58, 52, 70, 20, 40), "", "");
        assertEquals(54, result.rawScore());
        assertEquals(54, result.percentage());
        assertEquals("mod", result.key());
    }

    @Test
    void classifiesUniformlyLowInputsAsLowRisk() {
        RiskAssessment result = RiskModel.analyzeRisk(factors(20, 20, 20, 20, 20), "", "");
        assertEquals(20, result.percentage());
        assertEquals("low", result.key());
    }

    @Test
    void appliesAHighRiskFloorForSevereRoadFlooding() {
        RiskAssessment result = RiskModel.analyzeRisk(factors(10, 70, 10, 0, 0), "", "");
        assertEquals(33, result.rawScore());
        assertEquals(60, result.percentage());
        assertEquals("high", result.key());
        assertTrue(result.safetyRule().toLowerCase().contains("flood / road score is 70"));
    }

    @Test
    void appliesACriticalFloorForExtremeRoadFlooding() {
        RiskAssessment result = RiskModel.analyzeRisk(factors(10, 90, 10, 0, 0), "", "");
        assertEquals(80, result.percentage());
        assertEquals("crit", result.key());
    }

    @Test
    void appliesTheCorroboratedSevereWeatherFloor() {
        RiskAssessment result = RiskModel.analyzeRisk(factors(85, 10, 70, 0, 0), "", "");
        assertEquals(60, result.percentage());
        assertEquals("high", result.key());
    }
}
