package com.safego.demo.api;

import com.safego.demo.data.MockRepository;
import com.safego.demo.model.ResolvedPlace;
import com.safego.demo.model.SafeGoLocation;
import com.safego.demo.model.TripAnalysis;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class DemoRouteTest {

    private static final double[] ESPANA = {14.612, 120.9902};
    private static final double[] LERMA = {14.6049, 120.9888};
    private static final double[] QUIAPO = {14.5995, 120.9842};

    private final TripAnalyzeController controller = new TripAnalyzeController(null);

    @Test
    void savedDemoRouteIsLimitedToTheDocumentedExample() {
        assertNotNull(TripAnalyzeController.savedDemoRoute(ESPANA, LERMA));
        assertNull(TripAnalyzeController.savedDemoRoute(ESPANA, new double[]{14.5665, 121.02}));
    }

    @Test
    void savedDemoRouteSupportsBothDirectionsAndRemainsWithinPilotCoverage() {
        TripAnalyzeController.RouteResult forward = TripAnalyzeController.savedDemoRoute(ESPANA, LERMA);
        TripAnalyzeController.RouteResult reverse = TripAnalyzeController.savedDemoRoute(LERMA, ESPANA);

        assertNotNull(forward);
        assertNotNull(reverse);
        assertEquals("saved-demo", forward.source());
        assertEquals("saved-demo", reverse.source());

        assertEquals(forward.coordinates().length, reverse.coordinates().length);
        int len = forward.coordinates().length;
        for (int i = 0; i < len; i++) {
            assertEquals(forward.coordinates()[i][0], reverse.coordinates()[len - 1 - i][0], 0.000001);
            assertEquals(forward.coordinates()[i][1], reverse.coordinates()[len - 1 - i][1], 0.000001);
        }

        List<SafeGoLocation> locations = MockRepository.listDashboardLocations();
        ResolvedPlace origin = new ResolvedPlace("España", ESPANA, "preset", "espana", true);
        ResolvedPlace dest = new ResolvedPlace("Lerma", LERMA, "preset", "lerma", true);

        TripAnalysis analysis = controller.assessTrip(origin, dest, forward, locations);
        assertEquals("sufficient", analysis.coverage().status());
    }

    @Test
    void savedManilaDemoRoutesAreFullyCovered() {
        List<SafeGoLocation> locations = MockRepository.listDashboardLocations();
        double[][][] pairs = {{ESPANA, QUIAPO}, {QUIAPO, ESPANA}, {QUIAPO, LERMA}, {LERMA, QUIAPO}};
        for (double[][] pair : pairs) {
            TripAnalyzeController.RouteResult route = TripAnalyzeController.savedDemoRoute(pair[0], pair[1]);
            assertNotNull(route);
            assertEquals("saved-demo", route.source());
            ResolvedPlace origin = new ResolvedPlace("A", pair[0], "preset", null, true);
            ResolvedPlace dest = new ResolvedPlace("B", pair[1], "preset", null, true);
            assertEquals("sufficient", controller.assessTrip(origin, dest, route, locations).coverage().status());
        }
    }
}
