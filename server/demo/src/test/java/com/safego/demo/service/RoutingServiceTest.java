package com.safego.demo.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.safego.demo.api.TripAnalyzeController.RouteResult;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

class RoutingServiceTest {

    private final RoutingService routing = new RoutingService(null, new ObjectMapper());

    private static String route(double duration, double distance, String road) {
        return """
            {"duration": %s, "distance": %s,
             "geometry": {"type": "LineString", "coordinates": [[120.99, 14.61], [121.00, 14.60]]},
             "legs": [{"steps": [{"name": "%s"}, {"name": ""}, {"name": "%s"}]}]}
            """.formatted(duration, distance, road, road);
    }

    @Test
    void readsTheMainRouteAndItsAlternativesWithTimeAndDistance() throws Exception {
        String body = "{\"code\": \"Ok\", \"routes\": [" + route(1500, 9800, "España Blvd")
            + "," + route(1720, 10400, "Quezon Ave") + "]}";
        List<RouteResult> routes = routing.parseRoutes(body);
        assertEquals(2, routes.size());
        assertEquals(Double.valueOf(1500.0), routes.get(0).durationSeconds());
        assertEquals(Double.valueOf(10400.0), routes.get(1).distanceMeters());
        assertEquals(List.of("España Blvd"), routes.get(0).roadNames());
        // OSRM returns [lon, lat]; SafeGo uses [lat, lon].
        assertEquals(14.61, routes.get(0).coordinates()[0][0], 1e-9);
        assertEquals("osrm", routes.get(1).source());
    }

    @Test
    void keepsAtMostTheMainRoutePlusThreeAlternatives() throws Exception {
        StringBuilder body = new StringBuilder("{\"code\": \"Ok\", \"routes\": [");
        for (int i = 0; i < 6; i++) body.append(i == 0 ? "" : ",").append(route(1000 + i, 5000, "Road " + i));
        List<RouteResult> routes = routing.parseRoutes(body.append("]}").toString());
        assertEquals(RoutingService.MAX_ALTERNATIVES + 1, routes.size());
    }

    @Test
    void missingTimeOrDistanceStaysUnknown() throws Exception {
        String body = "{\"code\": \"Ok\", \"routes\": [{\"geometry\": {\"coordinates\": [[120.99, 14.61], [121.0, 14.6]]}}]}";
        RouteResult only = routing.parseRoutes(body).get(0);
        assertNull(only.durationSeconds());
        assertNull(only.distanceMeters());
    }

    @Test
    void noRouteIsAnError() {
        assertThrows(Exception.class, () -> routing.parseRoutes("{\"code\": \"NoRoute\", \"message\": \"No route\"}"));
    }
}
