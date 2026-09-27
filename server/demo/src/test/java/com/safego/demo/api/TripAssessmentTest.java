package com.safego.demo.api;

import com.safego.demo.data.MockRepository;
import com.safego.demo.model.ResolvedPlace;
import com.safego.demo.model.RiskAssessment;
import com.safego.demo.model.SafeGoLocation;
import com.safego.demo.model.TripAnalysis;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class TripAssessmentTest {

    private final TripAnalyzeController controller = new TripAnalyzeController(null);

    private static final double[] ESPANA = {14.612, 120.9902};
    private static final double[] LERMA = {14.6049, 120.9888};

    @Test
    void refreshUpdatesTripScoresAndConditionsWhilePreservingTheResolvedRoute() {
        List<SafeGoLocation> initialLocations = MockRepository.listDashboardLocations();
        ResolvedPlace origin = new ResolvedPlace("España", ESPANA, "preset", "espana", true);
        ResolvedPlace destination = new ResolvedPlace("Lerma", LERMA, "preset", "lerma", true);
        TripAnalyzeController.RouteResult route = TripAnalyzeController.savedDemoRoute(ESPANA, LERMA);
        assertNotNull(route);

        TripAnalysis initial = controller.assessTrip(origin, destination, route, initialLocations);

        List<SafeGoLocation> updatedLocations = initialLocations.stream().map(l -> {
            RiskAssessment updatedRisk = new RiskAssessment(
                "crit", "CRITICAL RISK", "Level 4 of 4", 95, 95, "", List.of(), "", "", "1.0.0"
            );
            return new SafeGoLocation(
                l.id(), l.name(), l.city(), l.aliases(), l.coordinates(),
                l.updated(), l.riskSummary(), l.riskStatus(), l.stats(),
                l.factors(), List.of(), l.universities(), List.of(), l.points(),
                List.of(), List.of(), updatedRisk
            );
        }).toList();

        TripAnalysis refreshed = controller.assessTrip(initial.origin(), initial.destination(), route, updatedLocations);

        assertNotEquals(initial.overallRiskScore(), refreshed.overallRiskScore());
        assertEquals(95, refreshed.overallRiskScore());
        assertEquals("crit", refreshed.riskKey());
        assertTrue(refreshed.advisories().isEmpty());
        assertTrue(refreshed.hazards().isEmpty());
        assertTrue(refreshed.reports().isEmpty());
        assertEquals(initial.routeCoordinates().length, refreshed.routeCoordinates().length);
        assertEquals(initial.origin().label(), refreshed.origin().label());
        assertEquals("saved-demo", refreshed.routingSource());
    }

    @Test
    void refreshRemovesATripRatingWhenCoverageDataDisappears() {
        List<SafeGoLocation> initialLocations = MockRepository.listDashboardLocations();
        ResolvedPlace origin = new ResolvedPlace("España", ESPANA, "preset", "espana", true);
        ResolvedPlace destination = new ResolvedPlace("Lerma", LERMA, "preset", "lerma", true);
        TripAnalyzeController.RouteResult route = TripAnalyzeController.savedDemoRoute(ESPANA, LERMA);
        assertNotNull(route);

        TripAnalysis initial = controller.assessTrip(origin, destination, route, initialLocations);
        TripAnalysis refreshed = controller.assessTrip(initial.origin(), initial.destination(), route, List.of());

        assertNull(refreshed.overallRiskScore());
        assertEquals("unknown", refreshed.riskKey());
        assertTrue(refreshed.corridorLocations().isEmpty());
    }
}
