package com.safego.demo.api;

import com.safego.demo.data.MockRepository;
import com.safego.demo.data.RiskModel;
import com.safego.demo.model.*;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class RouteRiskTest {

    private final TripAnalyzeController controller = new TripAnalyzeController(null);

    @Test
    void distanceCalculationIsZeroForTheSamePoint() {
        assertEquals(0.0, TripAnalyzeController.distanceKm(new double[]{14.6, 121.0}, new double[]{14.6, 121.0}), 0.0001);
    }

    @Test
    void routeAnalysisUsesExistingCalculatedLocationRisks() {
        List<SafeGoLocation> locations = MockRepository.listDashboardLocations();
        SafeGoLocation espana = locations.stream().filter(l -> "espana".equals(l.id())).findFirst().orElseThrow();

        ResolvedPlace origin = new ResolvedPlace(espana.name(), espana.coordinates(), "preset", espana.id(), true);
        ResolvedPlace dest = new ResolvedPlace("Nearby", new double[]{14.613, 120.991}, "preset", null, true);
        TripAnalyzeController.RouteResult route = new TripAnalyzeController.RouteResult(
            new double[][]{espana.coordinates(), {14.613, 120.991}},
            List.of("Lacson Ave"), "simulation"
        );

        TripAnalysis result = controller.assessTrip(origin, dest, route, locations);

        assertEquals("espana", result.segments().get(0).basisLocationId());
        assertEquals(espana.risk().percentage(), result.segments().get(0).riskScore());
        assertEquals(espana.risk().percentage(), result.overallRiskScore());
    }

    @Test
    void routeAnalysisAppliesAHighRiskFloor() {
        List<SafeGoLocation> baseLocations = MockRepository.listDashboardLocations();
        List<SafeGoLocation> locations = new ArrayList<>();
        for (int index = 0; index < baseLocations.size(); index++) {
            SafeGoLocation loc = baseLocations.get(index);
            int score = (index == 1) ? 70 : 20;
            RiskAssessment risk = new RiskAssessment("mod", "MODERATE RISK", "Level 2 of 4", score, score, "", List.of(), "", "", "1.0.0");
            locations.add(new SafeGoLocation(
                loc.id(), loc.name(), loc.city(), loc.aliases(),
                new double[]{14.6, 121.0 + index * 0.01},
                loc.updated(), loc.riskSummary(), loc.riskStatus(),
                loc.stats(), loc.factors(), loc.advisories(), loc.universities(),
                loc.reports(), loc.points(), loc.floods(), loc.hazards(), risk
            ));
        }

        ResolvedPlace origin = new ResolvedPlace("A", new double[]{14.6, 121.0}, "preset", null, true);
        ResolvedPlace dest = new ResolvedPlace("B", new double[]{14.6, 121.02}, "preset", null, true);
        TripAnalyzeController.RouteResult route = new TripAnalyzeController.RouteResult(
            new double[][]{{14.6, 121.0}, {14.6, 121.01}, {14.6, 121.02}},
            List.of(), "simulation"
        );

        TripAnalysis result = controller.assessTrip(origin, dest, route, locations);

        assertEquals(60, result.overallRiskScore());
        assertTrue(result.safetyRule().contains("High route floor"));
    }

    @Test
    void distantRoutesHaveUnknownSegmentsAndNoOverallScore() {
        List<SafeGoLocation> locations = MockRepository.listDashboardLocations();
        ResolvedPlace origin = new ResolvedPlace("Cebu 1", new double[]{10.3, 123.8}, "nominatim", null, true);
        ResolvedPlace dest = new ResolvedPlace("Cebu 2", new double[]{10.31, 123.81}, "nominatim", null, true);
        TripAnalyzeController.RouteResult route = new TripAnalyzeController.RouteResult(
            new double[][]{{10.3, 123.8}, {10.31, 123.81}},
            List.of(), "simulation"
        );

        TripAnalysis result = controller.assessTrip(origin, dest, route, locations);

        assertNull(result.overallRiskScore());
        assertNull(result.rawRiskScore());
        assertEquals(0.0, result.coverage().coveredPercent());
        assertTrue(result.segments().stream().allMatch(s -> s.riskScore() == null && s.basisLocationId() == null));
    }

    @Test
    void clonedDemoLocationsCannotExpandThePilot() {
        List<SafeGoLocation> locations = MockRepository.listDashboardLocations();
        ResolvedPlace origin = new ResolvedPlace("Katipunan 1", new double[]{14.6405, 121.0741}, "preset", "katipunan", true);
        ResolvedPlace dest = new ResolvedPlace("Katipunan 2", new double[]{14.641, 121.075}, "preset", "katipunan", true);
        TripAnalyzeController.RouteResult route = new TripAnalyzeController.RouteResult(
            new double[][]{{14.6405, 121.0741}, {14.641, 121.075}},
            List.of(), "simulation"
        );

        TripAnalysis result = controller.assessTrip(origin, dest, route, locations);
        assertEquals(0.0, result.coverage().coveredPercent());
    }

    @Test
    void missingPilotDataIsUnknownNotZeroRisk() {
        ResolvedPlace origin = new ResolvedPlace("A", new double[]{14.612, 120.9902}, "preset", null, true);
        ResolvedPlace dest = new ResolvedPlace("B", new double[]{14.613, 120.991}, "preset", null, true);
        TripAnalyzeController.RouteResult route = new TripAnalyzeController.RouteResult(
            new double[][]{{14.612, 120.9902}, {14.613, 120.991}},
            List.of(), "simulation"
        );

        TripAnalysis result = controller.assessTrip(origin, dest, route, List.of());

        assertNull(result.overallRiskScore());
        assertEquals("insufficient", result.coverage().status());
    }

    @Test
    void roadBendsArePreservedAndUncoveredDistanceIsMeasuredByLength() {
        List<SafeGoLocation> locations = MockRepository.listDashboardLocations();
        double[][] routeCoords = {{14.612, 120.9902}, {14.63, 121.01}, {14.6121, 120.9903}};
        ResolvedPlace origin = new ResolvedPlace("A", routeCoords[0], "preset", null, true);
        ResolvedPlace dest = new ResolvedPlace("B", routeCoords[2], "preset", null, true);
        TripAnalyzeController.RouteResult route = new TripAnalyzeController.RouteResult(routeCoords, List.of(), "simulation");

        TripAnalysis result = controller.assessTrip(origin, dest, route, locations);

        assertTrue(result.segments().stream().anyMatch(seg ->
            java.util.Arrays.stream(seg.coordinates()).anyMatch(pt -> pt[0] == routeCoords[1][0] && pt[1] == routeCoords[1][1])
        ));
        assertTrue(result.coverage().longestUnknownGapMeters() > 1000);
        assertNull(result.overallRiskScore());
        assertEquals(result.coverage().totalMeters(),
            result.coverage().coveredMeters() + result.coverage().unknownMeters(), 0.001);
    }

    @Test
    void coverageIncludesNoEdgeExtendingBeyondThePilotRadius() {
        List<SafeGoLocation> locations = MockRepository.listDashboardLocations();
        double[][] routeCoords = {{14.612, 120.9902}, {14.63, 120.9902}};
        ResolvedPlace origin = new ResolvedPlace("A", routeCoords[0], "preset", null, true);
        ResolvedPlace dest = new ResolvedPlace("B", routeCoords[1], "preset", null, true);
        TripAnalyzeController.RouteResult route = new TripAnalyzeController.RouteResult(routeCoords, List.of(), "simulation");

        TripAnalysis result = controller.assessTrip(origin, dest, route, locations);

        for (RouteRiskSegment segment : result.segments()) {
            if ("covered".equals(segment.coverage())) {
                SafeGoLocation basis = locations.stream()
                    .filter(l -> l.id().equals(segment.basisLocationId()))
                    .findFirst()
                    .orElseThrow();
                for (double[] pt : segment.coordinates()) {
                    assertTrue(TripAnalyzeController.distanceKm(pt, basis.coordinates()) * 1000.0 <= 850.0);
                }
            }
        }
    }

    @Test
    void duplicateAndInvalidGeometryCannotProduceAFalseLowScore() {
        List<SafeGoLocation> locations = MockRepository.listDashboardLocations();
        ResolvedPlace origin = new ResolvedPlace("A", new double[]{14.6, 121.0}, "preset", null, true);
        ResolvedPlace dest = new ResolvedPlace("B", new double[]{14.6, 121.0}, "preset", null, true);

        TripAnalyzeController.RouteResult dupRoute = new TripAnalyzeController.RouteResult(
            new double[][]{{14.6, 121.0}, {14.6, 121.0}}, List.of(), "simulation"
        );
        TripAnalyzeController.TripError dupError = assertThrows(TripAnalyzeController.TripError.class, () ->
            controller.assessTrip(origin, dest, dupRoute, locations)
        );
        assertTrue(dupError.getMessage().toLowerCase().contains("distinct"));

        TripAnalyzeController.RouteResult nanRoute = new TripAnalyzeController.RouteResult(
            new double[][]{{Double.NaN, 121.0}, {14.6, 121.0}}, List.of(), "simulation"
        );
        TripAnalyzeController.TripError nanError = assertThrows(TripAnalyzeController.TripError.class, () ->
            controller.assessTrip(origin, dest, nanRoute, locations)
        );
        assertTrue(nanError.getMessage().toLowerCase().contains("valid coordinates"));
    }

    @Test
    void the90PercentGateUsesUnroundedCoverageAndNeverTreatsGapsAsZero() {
        SafeGoLocation base = MockRepository.listDashboardLocations().get(0);
        RiskAssessment risk = new RiskAssessment("high", "HIGH RISK", "Level 3 of 4", 70, 70, "", List.of(), "", "", "1.0.0");
        SafeGoLocation location = new SafeGoLocation(
            base.id(), base.name(), base.city(), base.aliases(),
            new double[]{14.6, 121.0}, base.updated(), base.riskSummary(), base.riskStatus(),
            base.stats(), base.factors(), base.advisories(), base.universities(),
            base.reports(), base.points(), base.floods(), base.hazards(), risk
        );
        List<SafeGoLocation> locations = List.of(location);

        List<double[]> excursion = new ArrayList<>();
        for (int i = 0; i <= 100; i++) {
            excursion.add(new double[]{14.6 + (i * 10.0) / 111195.0, 121.0});
        }
        List<double[]> baseLoop = new ArrayList<>(excursion);
        for (int i = excursion.size() - 2; i >= 0; i--) {
            baseLoop.add(excursion.get(i));
        }

        List<double[]> routeBelow = new ArrayList<>(baseLoop);
        for (int i = 0; i < 5; i++) {
            routeBelow.add(new double[]{14.6 + 100.0 / 111195.0, 121.0});
            routeBelow.add(new double[]{14.6, 121.0});
        }

        List<double[]> routeAbove = new ArrayList<>(baseLoop);
        for (int i = 0; i < 10; i++) {
            routeAbove.add(new double[]{14.6 + 100.0 / 111195.0, 121.0});
            routeAbove.add(new double[]{14.6, 121.0});
        }

        ResolvedPlace orig = new ResolvedPlace("A", new double[]{14.6, 121.0}, "preset", null, true);
        ResolvedPlace d = new ResolvedPlace("B", new double[]{14.6, 121.0}, "preset", null, true);

        TripAnalysis below = controller.assessTrip(orig, d,
            new TripAnalyzeController.RouteResult(routeBelow.toArray(double[][]::new), List.of(), "simulation"),
            locations);

        TripAnalysis above = controller.assessTrip(orig, d,
            new TripAnalyzeController.RouteResult(routeAbove.toArray(double[][]::new), List.of(), "simulation"),
            locations);

        assertTrue(below.coverage().coveredPercent() < 90.0);
        assertNull(below.overallRiskScore());

        assertTrue(above.coverage().coveredPercent() >= 90.0 && above.coverage().coveredPercent() < 100.0);
        assertEquals(70, above.overallRiskScore());
        assertTrue(above.segments().stream().anyMatch(s -> s.riskScore() == null));
    }

    @Test
    void continuousUnknownSectionsPreserveAVisibleDashedPolyline() {
        List<SafeGoLocation> locations = MockRepository.listDashboardLocations();
        double[][] routeCoords = {{10.3, 123.8}, {10.31, 123.81}, {10.32, 123.8}};
        ResolvedPlace origin = new ResolvedPlace("Cebu 1", routeCoords[0], "preset", null, true);
        ResolvedPlace dest = new ResolvedPlace("Cebu 2", routeCoords[2], "preset", null, true);
        TripAnalyzeController.RouteResult route = new TripAnalyzeController.RouteResult(routeCoords, List.of(), "simulation");

        TripAnalysis result = controller.assessTrip(origin, dest, route, locations);

        assertEquals(1, result.segments().size());
        assertTrue(result.segments().get(0).coordinates().length > 3);
        assertNull(result.segments().get(0).riskScore());
        assertNull(result.segments().get(0).basisLocationId());
    }
}
