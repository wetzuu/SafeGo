package com.safego.demo.data;

import com.fasterxml.jackson.databind.JsonNode;
import com.safego.demo.model.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;

@Service
public class DashboardService {

    private static final long CACHE_MS = 60_000;

    private final PostgresRepository database;
    private final String backend;
    private final WeatherService weatherService;
    private final OperationalFeedService feedService;

    private DashboardSnapshot cached;
    private long expiresAt;

    public DashboardService() {
        this(new WeatherService(), new OperationalFeedService());
    }

    @Autowired
    public DashboardService(WeatherService weatherService, OperationalFeedService feedService) {
        this.weatherService = weatherService;
        this.feedService = feedService;

        String mode = System.getenv().getOrDefault("SAFEGO_DATA_MODE", "auto").trim().toLowerCase(Locale.ROOT);
        String url = System.getenv("DATABASE_URL");
        if (!List.of("auto", "mock", "database").contains(mode)) {
            throw new IllegalArgumentException("SAFEGO_DATA_MODE must be auto, mock, or database.");
        }
        if (mode.equals("database") && (url == null || url.isBlank())) {
            throw new IllegalArgumentException("DATABASE_URL is required for database mode.");
        }
        boolean useDatabase = mode.equals("database") || (mode.equals("auto") && url != null && !url.isBlank());
        this.database = useDatabase ? new PostgresRepository(url) : null;
        this.backend = useDatabase ? "database" : "mock";
    }

    public String backend() {
        return backend;
    }

    public List<SafeGoLocation> canonicalLocations() {
        return database == null
            ? MockRepository.listDashboardLocations()
            : database.listDashboardLocations();
    }

    public synchronized DashboardSnapshot snapshot(boolean refresh) {
        if (!refresh && cached != null && System.currentTimeMillis() < expiresAt) {
            return cached;
        }

        List<SafeGoLocation> locations = canonicalLocations();

        List<SourceStatus> sources = new ArrayList<>(
            database == null ? MockRepository.listSourceStatuses() : database.listSourceStatuses()
        );
        sources.removeIf(source -> List.of("official-advisories", "flood-road", "open-meteo").contains(source.key()));

        OperationalFeedService.FeedResult official = feedService.readFeed(
            "official-advisories", "Configured official advisory feed",
            "SAFEGO_OFFICIAL_ADVISORY_FEED_URL", "SAFEGO_OFFICIAL_ADVISORY_FEED_TOKEN", true
        );
        OperationalFeedService.FeedResult floodRoad = feedService.readFeed(
            "flood-road", "Configured flood and road feed",
            "SAFEGO_FLOOD_ROAD_FEED_URL", "SAFEGO_FLOOD_ROAD_FEED_TOKEN", false
        );

        sources.add(official.status());
        sources.add(floodRoad.status());
        if ("active".equals(official.status().status())) {
            locations = feedService.applyFeed(locations, official.items(), true);
        }
        if ("active".equals(floodRoad.status().status())) {
            locations = feedService.applyFeed(locations, floodRoad.items(), false);
        }

        String weatherUpdatedAt = null;
        String provider = System.getenv().getOrDefault("SAFEGO_WEATHER_PROVIDER", "open-meteo").trim().toLowerCase(Locale.ROOT);
        if ("disabled".equals(provider)) {
            sources.add(OperationalFeedService.status("open-meteo", "Open-Meteo forecast models", "weather", "disabled", null));
        } else if (!"open-meteo".equals(provider)) {
            sources.add(OperationalFeedService.status("open-meteo", "Open-Meteo forecast models", "weather", "degraded",
                "SAFEGO_WEATHER_PROVIDER must be open-meteo or disabled."));
        } else {
            try {
                locations = weatherService.fetchAndApplyWeather(locations);
                weatherUpdatedAt = Instant.now().toString();
                sources.add(new SourceStatus("open-meteo", "Open-Meteo forecast models", "weather", "active",
                    weatherUpdatedAt, null, null));
            } catch (Exception e) {
                sources.add(OperationalFeedService.status("open-meteo", "Open-Meteo forecast models", "weather", "degraded",
                    OperationalFeedService.safeMessage(e)));
            }
        }

        cached = new DashboardSnapshot(List.copyOf(locations), List.copyOf(sources), weatherUpdatedAt);
        expiresAt = System.currentTimeMillis() + CACHE_MS;
        return cached;
    }

    public synchronized void invalidate() {
        expiresAt = 0;
    }

    public Optional<CommunityReport> submitCommunityReport(
            String locationId, String reportType, String locationText, String description) {
        Optional<CommunityReport> report = database == null
            ? MockRepository.submitCommunityReport(locationId, reportType, locationText, description)
            : database.submitCommunityReport(locationId, reportType, locationText, description);
        if (report.isPresent()) invalidate();
        return report;
    }

    // Static and instance delegations for tests and backward compatibility
    public static int scoreWeather(int code, double rain, double gust) {
        return WeatherService.scoreWeather(code, rain, gust);
    }

    public static String weatherLabel(int code) {
        return WeatherService.weatherLabel(code);
    }

    public static List<JsonNode> parseFeedItems(JsonNode root, boolean official) {
        return OperationalFeedService.parseFeedItems(root, official);
    }

    public List<SafeGoLocation> applyFeed(List<SafeGoLocation> locations, List<JsonNode> all, boolean official) {
        return feedService.applyFeed(locations, all, official);
    }

    public record FeedResult(List<JsonNode> items, SourceStatus status) {}
}
