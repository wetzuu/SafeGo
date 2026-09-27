package com.safego.demo.api;

import com.safego.demo.data.MockRepository;
import com.safego.demo.data.RiskModel;
import com.safego.demo.model.*;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class ValidationScenariosTest {

    private final TripAnalyzeController controller = new TripAnalyzeController(null);

    private static final double[][] LOCAL_ROUTE = {
        {14.612, 120.9902}, {14.613, 120.991}
    };
    private static final double[][] GAP_ROUTE = {
        {14.612, 120.9902}, {14.59, 121.005}, {14.5665, 121.02}
    };
    private static final double[][] OUTSIDE_ROUTE = {
        {10.3157, 123.8854}, {10.32, 123.9}
    };

    private TripAnalysis replayScenario(Map<String, Integer> scores, double[][] route) {
        List<SafeGoLocation> locations = MockRepository.listDashboardLocations().stream()
            .filter(l -> TripAnalyzeController.PILOT_LOCATION_IDS.contains(l.id()))
            .map(l -> {
                List<RiskFactor> factors = l.factors().stream()
                    .map(f -> new RiskFactor(f.name(), scores.getOrDefault(f.name(), 20),
                        "low", "Test", "Synthetic validation input; not a current observation.",
                        f.icon(), f.tone()))
                    .toList();
                RiskAssessment risk = RiskModel.analyzeRisk(factors, "Synthetic validation scenario.", "Simulation");
                return new SafeGoLocation(l.id(), l.name(), l.city(), l.aliases(), l.coordinates(),
                    "simulation", risk.summary(), "Simulation", l.stats(), factors, List.of(), l.universities(),
                    List.of(), List.of(), List.of(), List.of(), risk);
            })
            .toList();

        ResolvedPlace origin = new ResolvedPlace("Simulated origin", route[0], "preset", null, true);
        ResolvedPlace dest = new ResolvedPlace("Simulated destination", route[route.length - 1], "preset", null, true);
        TripAnalyzeController.RouteResult rr = new TripAnalyzeController.RouteResult(route, List.of(), "simulation");
        return controller.assessTrip(origin, dest, rr, locations);
    }

    @Test
    void curatedScenarioCalmCoveredRoute() {
        TripAnalysis trip = replayScenario(Map.of(), LOCAL_ROUTE);
        assertEquals("low", trip.riskKey());
        assertEquals(20, trip.overallRiskScore());
    }

    @Test
    void curatedScenarioSevereFloodingDespiteCalmWeather() {
        TripAnalysis trip = replayScenario(Map.of(
            "Weather", 10,
            "Flood / roads", 70,
            "Official advisories", 10,
            "School status", 0,
            "Community reports", 0
        ), LOCAL_ROUTE);
        assertEquals("high", trip.riskKey());
        assertEquals(60, trip.overallRiskScore());
    }

    @Test
    void curatedScenarioCriticalRoadFlooding() {
        TripAnalysis trip = replayScenario(Map.of(
            "Weather", 10,
            "Flood / roads", 90,
            "Official advisories", 10,
            "School status", 0,
            "Community reports", 0
        ), LOCAL_ROUTE);
        assertEquals("crit", trip.riskKey());
        assertEquals(80, trip.overallRiskScore());
    }

    @Test
    void curatedScenarioSevereWeatherWithAnElevatedAdvisory() {
        TripAnalysis trip = replayScenario(Map.of(
            "Weather", 85,
            "Flood / roads", 10,
            "Official advisories", 70,
            "School status", 0,
            "Community reports", 0
        ), LOCAL_ROUTE);
        assertEquals("high", trip.riskKey());
        assertEquals(60, trip.overallRiskScore());
    }

    @Test
    void curatedScenarioCalmPointsWithALongUncoveredGap() {
        TripAnalysis trip = replayScenario(Map.of(), GAP_ROUTE);
        assertEquals("unknown", trip.riskKey());
        assertNull(trip.overallRiskScore());
    }

    @Test
    void curatedScenarioKnownCriticalSectionAndAnUnknownRemainder() {
        TripAnalysis trip = replayScenario(Map.of("Flood / roads", 90), GAP_ROUTE);
        assertEquals("unknown", trip.riskKey());
        assertNull(trip.overallRiskScore());
        assertTrue(trip.segments().stream().anyMatch(s -> "crit".equals(s.riskKey())));
        assertTrue(trip.segments().stream().anyMatch(s -> "unknown".equals(s.riskKey())));
    }

    @Test
    void curatedScenarioRouteOutsideThePilot() {
        TripAnalysis trip = replayScenario(Map.of(), OUTSIDE_ROUTE);
        assertEquals("unknown", trip.riskKey());
        assertNull(trip.overallRiskScore());
    }
}
