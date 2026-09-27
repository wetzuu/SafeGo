package com.safego.demo.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.safego.demo.model.ResolvedPlace;
import com.safego.demo.model.SafeGoLocation;
import com.safego.demo.util.GeoUtils;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class GeocodingService {

    private static final String NOMINATIM_BASE = "https://nominatim.openstreetmap.org/search";
    private static final long GEO_CACHE_MS = 24 * 60 * 60 * 1_000L;

    private final HttpClient httpClient;
    private final ObjectMapper mapper;
    private final ConcurrentHashMap<String, TimedValue<ResolvedPlace>> geoCache;

    public GeocodingService() {
        this(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(12)).build(), new ObjectMapper());
    }

    public GeocodingService(HttpClient httpClient, ObjectMapper mapper) {
        this.httpClient = httpClient;
        this.mapper = mapper;
        this.geoCache = new ConcurrentHashMap<>();
    }

    public ResolvedPlace resolvePlace(String query, List<SafeGoLocation> locations) throws Exception {
        String target = GeoUtils.normalize(query);
        Optional<SafeGoLocation> preset = locations.stream().filter(loc -> {
            List<String> candidates = new ArrayList<>();
            candidates.add(loc.id());
            candidates.add(loc.name());
            candidates.addAll(loc.aliases());
            return candidates.stream().anyMatch(candidate -> {
                String norm = GeoUtils.normalize(candidate);
                return norm.equals(target)
                    || (norm.contains(" ") && norm.length() >= 8 && target.contains(norm));
            });
        }).findFirst();

        if (preset.isPresent()) {
            SafeGoLocation loc = preset.get();
            return new ResolvedPlace(loc.name(), loc.coordinates(), "preset", loc.id(), true);
        }

        TimedValue<ResolvedPlace> cached = geoCache.get(target);
        if (cached != null && cached.expiresAt() > System.currentTimeMillis()) {
            return cached.value();
        }

        ResolvedPlace place = queryNominatim(query);
        geoCache.put(target, new TimedValue<>(place, System.currentTimeMillis() + GEO_CACHE_MS));
        return place;
    }

    public ResolvedPlace queryNominatim(String query) throws Exception {
        String url = NOMINATIM_BASE + "?q=" + URLEncoder.encode(query, StandardCharsets.UTF_8)
            + "&format=jsonv2&limit=1&countrycodes=ph&addressdetails=0";
        String contact = System.getenv("SAFEGO_CONTACT_EMAIL");
        String ua = "SafeGo-Prototype/0.1 " + (contact != null ? "(" + contact + ")" : "(local development)");

        HttpRequest req = HttpRequest.newBuilder(URI.create(url))
            .timeout(Duration.ofSeconds(10))
            .header("Accept", "application/json")
            .header("Accept-Language", "en")
            .header("User-Agent", ua)
            .GET()
            .build();

        HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() != 200) {
            throw new Exception("Geocoding service returned HTTP " + resp.statusCode() + ".");
        }

        List<?> results = mapper.readValue(resp.body(), List.class);
        if (results.isEmpty()) {
            throw new Exception("No Philippine location found for \"" + query + "\".");
        }
        Map<?, ?> first = (Map<?, ?>) results.get(0);
        double lat = Double.parseDouble((String) first.get("lat"));
        double lon = Double.parseDouble((String) first.get("lon"));
        String label = (String) first.get("display_name");
        return new ResolvedPlace(label, new double[]{lat, lon}, "nominatim", null, true);
    }

    public record TimedValue<T>(T value, long expiresAt) {}
}
