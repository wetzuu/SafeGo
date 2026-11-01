package com.safego.demo.data;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.List;
import java.util.Map;

/**
 * SafeGo's risk policy, loaded once from config/risk-policy.json (on the classpath as
 * /risk-policy.json). The web app imports the same file, so weights, bands, floors and pilot limits
 * are defined in exactly one place.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record RiskPolicy(
    String modelVersion,
    Map<String, Double> weights,
    List<Band> bands,
    Floors floors,
    Pilot pilot,
    CalmArea calmArea
) {
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Band(int maximum, String key, String name, String label, String rank) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Floors(int floodRoadHigh, int floodRoadCritical, int severeWeather, int elevatedAdvisory) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Pilot(String id, String name, List<String> locationIds, double radiusMeters,
            int minimumCoveragePercent, double sampleLengthMeters) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record CalmArea(List<String> factors, int maxFactorScore, double maxDistanceKm) {}

    public static final String RESOURCE = "/risk-policy.json";

    private static final RiskPolicy INSTANCE = load();

    public static RiskPolicy get() {
        return INSTANCE;
    }

    static RiskPolicy load() {
        try (InputStream in = RiskPolicy.class.getResourceAsStream(RESOURCE)) {
            if (in == null) throw new IllegalStateException(RESOURCE + " is missing from the classpath (config/risk-policy.json).");
            RiskPolicy policy = new ObjectMapper()
                .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false)
                .readValue(in, RiskPolicy.class);
            policy.validate();
            return policy;
        } catch (IOException e) {
            throw new UncheckedIOException("Could not read " + RESOURCE, e);
        }
    }

    /** Fails at startup rather than rating with a broken policy. */
    void validate() {
        double sum = weights.values().stream().mapToDouble(Double::doubleValue).sum();
        if (Math.abs(sum - 1.0) > 1e-9) throw new IllegalStateException("Risk weights must sum to 1, not " + sum);
        if (bands.isEmpty() || bands.get(bands.size() - 1).maximum() != 100) {
            throw new IllegalStateException("The last risk band must end at 100.");
        }
        for (int i = 1; i < bands.size(); i++) {
            if (bands.get(i).maximum() <= bands.get(i - 1).maximum()) throw new IllegalStateException("Risk bands must ascend.");
        }
        if (pilot.locationIds().isEmpty()) throw new IllegalStateException("The pilot needs at least one location.");
    }

    /** The band a 0–100 score falls in. */
    public Band band(int score) {
        return bands.stream().filter(b -> score <= b.maximum()).findFirst().orElse(bands.get(bands.size() - 1));
    }

    /** The lowest score in the band with this key, e.g. 60 for "high". */
    public int bandMinimum(String key) {
        for (int i = 0; i < bands.size(); i++) {
            if (bands.get(i).key().equals(key)) return i == 0 ? 0 : bands.get(i - 1).maximum() + 1;
        }
        throw new IllegalArgumentException("Unknown risk band: " + key);
    }
}
