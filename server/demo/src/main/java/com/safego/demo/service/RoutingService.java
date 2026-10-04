package com.safego.demo.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.safego.demo.api.TripAnalyzeController.RouteResult;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class RoutingService {

    private static final String OSRM_BASE = "https://router.project-osrm.org";
    private static final long ROUTE_CACHE_MS = 10 * 60 * 1_000L;

    private final HttpClient httpClient;
    private final ObjectMapper mapper;
    private final ConcurrentHashMap<String, TimedValue<RouteResult>> routeCache;

    public RoutingService() {
        this(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(12)).build(), new ObjectMapper());
    }

    public RoutingService(HttpClient httpClient, ObjectMapper mapper) {
        this.httpClient = httpClient;
        this.mapper = mapper;
        this.routeCache = new ConcurrentHashMap<>();
    }

    public RouteResult fetchRoute(double[] origin, double[] dest) throws Exception {
        String base = System.getenv("SAFEGO_ROUTING_BASE_URL");
        if (base == null) base = OSRM_BASE;

        String key = base + ":" + origin[1] + "," + origin[0] + ";" + dest[1] + "," + dest[0];
        TimedValue<RouteResult> cached = routeCache.get(key);
        if (cached != null && cached.expiresAt() > System.currentTimeMillis()) {
            return cached.value();
        }

        RouteResult route = queryOsrm(base, origin, dest);
        routeCache.put(key, new TimedValue<>(route, System.currentTimeMillis() + ROUTE_CACHE_MS));
        return route;
    }

    @SuppressWarnings("unchecked")
    public RouteResult queryOsrm(String base, double[] origin, double[] dest) throws Exception {
        String coords = dest[1] + "," + dest[0];
        String url = base + "/route/v1/driving/"
            + origin[1] + "," + origin[0] + ";" + coords
            + "?alternatives=false&steps=true&geometries=geojson&overview=full";

        HttpRequest req = HttpRequest.newBuilder(URI.create(url))
            .timeout(Duration.ofSeconds(12))
            .GET()
            .build();

        HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() != 200) {
            throw new Exception("Routing service returned HTTP " + resp.statusCode() + ".");
        }

        Map<String, Object> payload = mapper.readValue(resp.body(), Map.class);
        if (!"Ok".equals(payload.get("code"))) {
            String msg = (String) payload.getOrDefault("message", "No drivable route was found.");
            throw new Exception(msg);
        }

        List<Map<String, Object>> routes = (List<Map<String, Object>>) payload.get("routes");
        if (routes == null || routes.isEmpty()) throw new Exception("No drivable route was found.");

        Map<String, Object> route = routes.get(0);
        Map<String, Object> geometry = (Map<String, Object>) route.get("geometry");
        List<List<Double>> rawCoords = (List<List<Double>>) geometry.get("coordinates");

        double[][] routeCoords = rawCoords.stream()
            .map(c -> new double[]{c.get(1), c.get(0)})
            .toArray(double[][]::new);

        List<Map<String, Object>> legs = (List<Map<String, Object>>) route.get("legs");
        List<String> roadNames = new ArrayList<>();
        if (legs != null) {
            for (Map<String, Object> leg : legs) {
                List<Map<String, Object>> steps = (List<Map<String, Object>>) leg.get("steps");
                if (steps != null) {
                    for (Map<String, Object> step : steps) {
                        String name = (String) step.get("name");
                        if (name != null && !name.isBlank() && !roadNames.contains(name)) {
                            roadNames.add(name.trim());
                            if (roadNames.size() >= 8) break;
                        }
                    }
                }
                if (roadNames.size() >= 8) break;
            }
        }

        return new RouteResult(routeCoords, roadNames, "osrm");
    }

    public record TimedValue<T>(T value, long expiresAt) {}
}
