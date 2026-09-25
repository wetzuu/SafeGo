package com.safego.demo.data;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.safego.demo.model.*;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.HttpURLConnection;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class DashboardService {
    private static final ZoneId MANILA = ZoneId.of("Asia/Manila");
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("h:mm a", Locale.ENGLISH);
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.ENGLISH);
    private static final String WEATHER_FIELDS = "temperature_2m,relative_humidity_2m,precipitation,rain,showers,weather_code,wind_speed_10m,wind_gusts_10m";
    private static final long CACHE_MS = 60_000;
    private final ObjectMapper mapper = new ObjectMapper();
    private final PostgresRepository database;
    private final String backend;
    private DashboardSnapshot cached;
    private long expiresAt;

    public DashboardService() {
        String mode = System.getenv().getOrDefault("SAFEGO_DATA_MODE", "auto").trim().toLowerCase(Locale.ROOT);
        String url = System.getenv("DATABASE_URL");
        if (!List.of("auto", "mock", "database").contains(mode)) throw new IllegalArgumentException("SAFEGO_DATA_MODE must be auto, mock, or database.");
        if (mode.equals("database") && (url == null || url.isBlank())) throw new IllegalArgumentException("DATABASE_URL is required for database mode.");
        boolean useDatabase = mode.equals("database") || mode.equals("auto") && url != null && !url.isBlank();
        database = useDatabase ? new PostgresRepository(url) : null;
        backend = useDatabase ? "database" : "mock";
    }

    public String backend() { return backend; }

    public synchronized DashboardSnapshot snapshot(boolean refresh) {
        if (!refresh && cached != null && System.currentTimeMillis() < expiresAt) return cached;
        List<SafeGoLocation> locations = database == null ? MockRepository.listDashboardLocations() : database.listDashboardLocations();
        List<SourceStatus> sources = new ArrayList<>(database == null ? MockRepository.listSourceStatuses() : database.listSourceStatuses());
        sources.removeIf(source -> List.of("official-advisories", "flood-road", "open-meteo").contains(source.key()));

        FeedResult official = readFeed("official-advisories", "Configured official advisory feed",
            "SAFEGO_OFFICIAL_ADVISORY_FEED_URL", "SAFEGO_OFFICIAL_ADVISORY_FEED_TOKEN", true);
        FeedResult floodRoad = readFeed("flood-road", "Configured flood and road feed",
            "SAFEGO_FLOOD_ROAD_FEED_URL", "SAFEGO_FLOOD_ROAD_FEED_TOKEN", false);
        sources.add(official.status());
        sources.add(floodRoad.status());
        if (official.status().status().equals("active")) locations = applyFeed(locations, official.items(), true);
        if (floodRoad.status().status().equals("active")) locations = applyFeed(locations, floodRoad.items(), false);

        String weatherUpdatedAt = null;
        String provider = System.getenv().getOrDefault("SAFEGO_WEATHER_PROVIDER", "open-meteo").trim().toLowerCase(Locale.ROOT);
        if (provider.equals("disabled")) {
            sources.add(status("open-meteo", "Open-Meteo forecast models", "weather", "disabled", null));
        } else if (!provider.equals("open-meteo")) {
            sources.add(status("open-meteo", "Open-Meteo forecast models", "weather", "degraded",
                "SAFEGO_WEATHER_PROVIDER must be open-meteo or disabled."));
        } else {
            try {
                locations = applyWeather(locations);
                weatherUpdatedAt = Instant.now().toString();
                sources.add(new SourceStatus("open-meteo", "Open-Meteo forecast models", "weather", "active",
                    weatherUpdatedAt, null, null));
            } catch (Exception e) {
                sources.add(status("open-meteo", "Open-Meteo forecast models", "weather", "degraded", safeMessage(e)));
            }
        }
        cached = new DashboardSnapshot(List.copyOf(locations), List.copyOf(sources), weatherUpdatedAt);
        expiresAt = System.currentTimeMillis() + CACHE_MS;
        return cached;
    }

    public synchronized void invalidate() {
        expiresAt = 0;
    }

    public Optional<CommunityReport> submitCommunityReport(String locationId, String reportType, String locationText, String description) {
        Optional<CommunityReport> report = database == null
            ? MockRepository.submitCommunityReport(locationId, reportType, locationText, description)
            : database.submitCommunityReport(locationId, reportType, locationText, description);
        if (report.isPresent()) invalidate();
        return report;
    }

    private List<SafeGoLocation> applyWeather(List<SafeGoLocation> locations) throws Exception {
        if (locations.isEmpty()) return locations;
        String latitudes = String.join(",", locations.stream().map(l -> String.valueOf(l.coordinates()[0])).toList());
        String longitudes = String.join(",", locations.stream().map(l -> String.valueOf(l.coordinates()[1])).toList());
        String url = "https://api.open-meteo.com/v1/forecast?latitude=" + latitudes + "&longitude=" + longitudes
            + "&current=" + URLEncoder.encode(WEATHER_FIELDS, StandardCharsets.UTF_8) + "&timezone=Asia%2FManila";
        JsonNode payload = request(url, null);
        List<JsonNode> observations = new ArrayList<>();
        if (payload.isArray()) payload.forEach(observations::add);
        else observations.add(payload);
        if (observations.size() != locations.size()) throw new IllegalStateException("Open-Meteo returned an unexpected number of locations.");
        List<SafeGoLocation> result = new ArrayList<>();
        for (int index = 0; index < locations.size(); index++) {
            JsonNode current = observations.get(index).path("current");
            for (String field : List.of("weather_code", "temperature_2m", "relative_humidity_2m", "precipitation", "wind_speed_10m", "wind_gusts_10m")) {
                if (!current.path(field).isNumber()) throw new IllegalStateException("Open-Meteo response is missing current weather fields.");
            }
            int code = current.path("weather_code").asInt();
            double rain = current.path("precipitation").asDouble();
            double gust = current.path("wind_gusts_10m").asDouble();
            double wind = current.path("wind_speed_10m").asDouble();
            double temp = current.path("temperature_2m").asDouble();
            String condition = weatherLabel(code);
            int score = scoreWeather(code, rain, gust);
            String description = String.format(Locale.ENGLISH,
                "%s, %.1f mm precipitation, winds %d km/h with gusts to %d km/h. Weather estimate from Open-Meteo.",
                condition, rain, Math.round(wind), Math.round(gust));
            SafeGoLocation location = locations.get(index);
            RiskFactor factor = new RiskFactor("Weather", score, bandKey(score), bandLabel(score), description, "weather", "icon-weather");
            List<Stat> stats = location.stats().stream().map(s -> s.label().equals("Weather")
                ? new Stat(s.label(), condition + ", " + Math.round(temp) + "°C",
                    String.format(Locale.ENGLISH, "%.1f mm · gusts %d km/h", rain, Math.round(gust)), s.icon(), s.tone()) : s).toList();
            String summary = "The latest weather estimate is included in this result. Other factors use the most recent information available to SafeGo.";
            String observed = current.path("time").asText();
            String updated = TIME.format(LocalDateTime.parse(observed).atZone(MANILA));
            result.add(copy(location, updated, summary, stats, replace(location.factors(), factor), location.advisories(), location.floods(), location.hazards()));
        }
        return result;
    }

    private FeedResult readFeed(String key, String name, String endpointKey, String tokenKey, boolean official) {
        String endpoint = System.getenv(endpointKey);
        if (endpoint == null || endpoint.isBlank()) return new FeedResult(List.of(), status(key, name, key, "disabled", null));
        try {
            URI uri = URI.create(endpoint.trim());
            if (!uri.getScheme().equals("https") && !"localhost".equals(uri.getHost())) throw new IllegalArgumentException("Feed endpoint must use HTTPS.");
            JsonNode root = request(uri.toString(), System.getenv(tokenKey));
            JsonNode items = root.path("items");
            if (!items.isArray() || items.size() > 1000) throw new IllegalArgumentException("Feed response items must be an array of at most 1000 entries.");
            Map<String, JsonNode> active = new LinkedHashMap<>();
            for (JsonNode item : items) {
                String id = required(item, "id", 120);
                String expiry = required(item, "expiresAt", 40);
                if (!Instant.parse(expiry).isAfter(Instant.now())) continue;
                required(item, "sourceName", 100);
                required(item, "title", 200);
                required(item, "description", 1000);
                String sourceUrl = required(item, "sourceUrl", 500);
                URI link = URI.create(sourceUrl);
                if (!link.getScheme().equals("https") && !"localhost".equals(link.getHost())) throw new IllegalArgumentException("Feed sourceUrl must use HTTPS.");
                JsonNode ids = item.path("locationIds");
                if (!ids.isArray() || ids.isEmpty() || ids.size() > 50) throw new IllegalArgumentException("Feed locationIds must contain 1 to 50 IDs.");
                for (JsonNode locationId : ids) if (!locationId.isTextual() || locationId.asText().length() > 80) throw new IllegalArgumentException("Invalid location ID.");
                int severity = item.path("severityScore").asInt(-1);
                if (!item.path("severityScore").isIntegralNumber() || severity < 0 || severity > 100) throw new IllegalArgumentException("Invalid severity score.");
                String kind = required(item, official ? "sourceKind" : "kind", 20);
                if (official && !List.of("gov", "school", "weather").contains(kind)) throw new IllegalArgumentException("Invalid advisory source kind.");
                if (!official && !List.of("flood", "road").contains(kind)) throw new IllegalArgumentException("Invalid flood/road kind.");
                Instant.parse(required(item, official ? "issuedAt" : "observedAt", 40));
                active.put(id, item);
            }
            return new FeedResult(List.copyOf(active.values()), status(key, name, key, "active", null));
        } catch (Exception e) {
            return new FeedResult(List.of(), status(key, name, key, "degraded", safeMessage(e)));
        }
    }

    private List<SafeGoLocation> applyFeed(List<SafeGoLocation> locations, List<JsonNode> all, boolean official) {
        List<SafeGoLocation> result = new ArrayList<>();
        for (SafeGoLocation location : locations) {
            List<JsonNode> items = all.stream().filter(item -> {
                for (JsonNode id : item.path("locationIds")) if (location.id().equals(id.asText())) return true;
                return false;
            }).toList();
            int highest = items.stream().mapToInt(i -> i.path("severityScore").asInt()).max().orElse(0);
            String name = official ? "Official advisories" : "Flood / roads";
            String description = items.isEmpty()
                ? official ? "No active advisory for this canonical location in the configured official feed." : "No active observation for this canonical location in the configured flood/road feed."
                : items.size() + (official ? " active configured official advisories; highest normalized severity " : " active verified-source observations; highest normalized severity ") + highest + "/100.";
            RiskFactor factor = new RiskFactor(name, highest, bandKey(highest), bandLabel(highest), description,
                official ? "alert" : "flood", highest >= 60 ? "icon-alert" : highest >= 30 ? "icon-mod" : "icon-ok");
            List<Advisory> advisories = location.advisories();
            List<Hazard> hazards = location.hazards();
            List<Hazard> floods = location.floods();
            if (official) {
                advisories = items.stream().map(item -> {
                    ZonedDateTime at = Instant.parse(item.path("issuedAt").asText()).atZone(MANILA);
                    return new Advisory(item.path("sourceKind").asText(), item.path("sourceName").asText(),
                        item.path("title").asText(), item.path("description").asText(), TIME.format(at), DATE.format(at), false,
                        item.path("sourceUrl").asText());
                }).toList();
            } else {
                hazards = items.stream().map(this::feedHazard).toList();
                floods = items.stream().filter(i -> i.path("kind").asText().equals("flood")).map(this::feedHazard).toList();
            }
            result.add(copy(location, location.updated(), location.riskSummary(), location.stats(), replace(location.factors(), factor), advisories, floods, hazards));
        }
        return result;
    }

    private Hazard feedHazard(JsonNode item) {
        int score = item.path("severityScore").asInt();
        String at = TIME.format(Instant.parse(item.path("observedAt").asText()).atZone(MANILA));
        return new Hazard(item.path("title").asText(), item.path("sourceName").asText() + " · " + at + " · " + item.path("description").asText(),
            score >= 60 ? "icon-alert" : score >= 30 ? "icon-mod" : "icon-ok", item.path("sourceUrl").asText());
    }

    private JsonNode request(String url, String token) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) URI.create(url).toURL().openConnection();
        connection.setConnectTimeout(8_000);
        connection.setReadTimeout(8_000);
        connection.setRequestProperty("Accept", "application/json");
        connection.setRequestProperty("User-Agent", "SafeGo/0.1");
        if (token != null && !token.isBlank()) connection.setRequestProperty("Authorization", "Bearer " + token.trim());
        try {
            int code = connection.getResponseCode();
            if (code < 200 || code >= 300) throw new IllegalStateException("Source returned HTTP " + code + ".");
            try (var body = connection.getInputStream()) {
                return mapper.readTree(body);
            }
        } finally {
            connection.disconnect();
        }
    }

    private static String required(JsonNode item, String field, int max) {
        JsonNode value = item.path(field);
        if (!value.isTextual() || value.asText().isBlank() || value.asText().length() > max) throw new IllegalArgumentException("Invalid feed field: " + field);
        return value.asText().trim();
    }

    private static SourceStatus status(String key, String name, String kind, String state, String error) {
        String now = Instant.now().toString();
        return new SourceStatus(key, name, kind, state, state.equals("active") ? now : null,
            state.equals("degraded") ? now : null, error);
    }

    private static String safeMessage(Exception e) {
        String message = e.getMessage();
        return message == null || message.isBlank() ? e.getClass().getSimpleName() : message;
    }

    private static List<RiskFactor> replace(List<RiskFactor> factors, RiskFactor replacement) {
        return factors.stream().map(f -> f.name().equals(replacement.name()) ? replacement : f).toList();
    }

    private static SafeGoLocation copy(SafeGoLocation source, String updated, String summary, List<Stat> stats,
            List<RiskFactor> factors, List<Advisory> advisories, List<Hazard> floods, List<Hazard> hazards) {
        return new SafeGoLocation(source.id(), source.name(), source.city(), source.aliases(), source.coordinates(), updated,
            summary, source.riskStatus(), stats, factors, advisories, source.universities(), source.reports(), source.points(),
            floods, hazards, RiskModel.analyzeRisk(factors, summary, source.riskStatus()));
    }

    private static String bandKey(int score) { return score <= 29 ? "low" : score <= 59 ? "mod" : score <= 79 ? "high" : "crit"; }
    private static String bandLabel(int score) { return score <= 29 ? "Low" : score <= 59 ? "Moderate" : score <= 79 ? "High" : "Critical"; }
    static int scoreWeather(int code, double rain, double gust) {
        return Math.max(codeScore(code), Math.max(rainScore(rain), gustScore(gust)));
    }
    private static int rainScore(double value) { return value >= 15 ? 90 : value >= 7.5 ? 70 : value >= 2.5 ? 45 : value >= .5 ? 25 : value >= .1 ? 10 : 0; }
    private static int gustScore(double value) { return value >= 100 ? 95 : value >= 75 ? 75 : value >= 50 ? 55 : value >= 35 ? 35 : value >= 20 ? 15 : 0; }
    private static int codeScore(int code) {
        if (code == 96 || code == 99) return 95;
        if (code == 95) return 80;
        if (List.of(65, 67, 82).contains(code)) return 70;
        if (List.of(63, 66, 81).contains(code)) return 55;
        if (List.of(61, 80).contains(code)) return 40;
        if (List.of(55, 57).contains(code)) return 45;
        if (List.of(53, 56).contains(code)) return 35;
        if (code == 51) return 25;
        if (code == 45 || code == 48) return 20;
        if (code == 1 || code == 2 || code == 3) return 5;
        return 0;
    }
    private static String weatherLabel(int code) {
        if (code == 0) return "Clear";
        if (List.of(1, 2, 3).contains(code)) return "Partly cloudy";
        if (code == 45 || code == 48) return "Foggy";
        if (List.of(51, 53, 55, 56, 57).contains(code)) return "Drizzle";
        if (List.of(61, 63, 65, 66, 67).contains(code)) return "Rain";
        if (List.of(71, 73, 75, 77, 85, 86).contains(code)) return "Snow";
        if (List.of(80, 81, 82).contains(code)) return "Rain showers";
        if (List.of(95, 96, 99).contains(code)) return "Thunderstorm";
        return "Unknown conditions";
    }

    private record FeedResult(List<JsonNode> items, SourceStatus status) {}
}
