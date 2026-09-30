package com.safego.demo.data;

import com.safego.demo.model.SourceStatus;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Live, rainfall-aware weather for the map's area sample points (one per city, per district in Manila).
 * Readings are cached for ten minutes and only Metro Manila coordinates are accepted, so the endpoint
 * cannot be used as a general Open-Meteo proxy.
 */
@Service
public class AreaWeatherService {

    public static final int MAX_POINTS = 60;
    private static final long CACHE_MS = 10 * 60 * 1000;
    // Metro Manila with a small margin.
    private static final double MIN_LAT = 14.30, MAX_LAT = 14.85, MIN_LON = 120.85, MAX_LON = 121.20;

    public record Point(String key, double latitude, double longitude) {}

    public record AreaReading(
        String key,
        int score,
        String driver,
        String condition,
        double temperatureCelsius,
        double windGustKph,
        double currentRateMmPerHour,
        double lastHourMm,
        double pastThreeHoursMm,
        double pastDayMm,
        double nextThreeHoursMm,
        String pagasaLevel,
        String observedAt
    ) {}

    public record Result(List<AreaReading> readings, SourceStatus source) {}

    private final WeatherService weather;
    private final Map<String, CachedResult> cache = new ConcurrentHashMap<>();

    private record CachedResult(long expiresAt, Result result) {}

    public AreaWeatherService(WeatherService weather) {
        this.weather = weather;
    }

    public static void validate(List<Point> points) {
        if (points == null || points.isEmpty()) throw new IllegalArgumentException("Send at least one point.");
        if (points.size() > MAX_POINTS) throw new IllegalArgumentException("Send at most " + MAX_POINTS + " points.");
        for (Point point : points) {
            if (point.key() == null || point.key().isBlank() || point.key().length() > 80) {
                throw new IllegalArgumentException("Each point needs a key of at most 80 characters.");
            }
            if (point.latitude() < MIN_LAT || point.latitude() > MAX_LAT || point.longitude() < MIN_LON || point.longitude() > MAX_LON) {
                throw new IllegalArgumentException("Points must be inside Metro Manila.");
            }
        }
    }

    public Result readings(List<Point> points) {
        validate(points);
        String provider = System.getenv().getOrDefault("SAFEGO_WEATHER_PROVIDER", "open-meteo").trim().toLowerCase(Locale.ROOT);
        if (!"open-meteo".equals(provider)) {
            return new Result(List.of(), OperationalFeedService.status("open-meteo", "Open-Meteo forecast models", "weather",
                "disabled".equals(provider) ? "disabled" : "degraded",
                "disabled".equals(provider) ? null : "SAFEGO_WEATHER_PROVIDER must be open-meteo or disabled."));
        }

        String cacheKey = cacheKey(points);
        CachedResult cached = cache.get(cacheKey);
        if (cached != null && cached.expiresAt() > System.currentTimeMillis()) return cached.result();

        try {
            List<WeatherService.Reading> fetched = weather.fetchReadings(
                points.stream().map(point -> new double[] {point.latitude(), point.longitude()}).toList());
            List<AreaReading> readings = new ArrayList<>();
            for (int i = 0; i < points.size(); i++) {
                WeatherService.Reading reading = fetched.get(i);
                RainfallScoring.Assessment a = reading.assessment();
                readings.add(new AreaReading(points.get(i).key(), a.score(), a.driver(), a.condition(),
                    reading.temperatureCelsius(), reading.windGustKph(), a.currentRateMmPerHour(), a.lastHourMm(),
                    a.pastThreeHoursMm(), a.pastDayMm(), a.nextThreeHoursMm(), a.pagasaLevel(), reading.observedAt()));
            }
            Result result = new Result(List.copyOf(readings), new SourceStatus("open-meteo", "Open-Meteo forecast models",
                "weather", "active", Instant.now().toString(), null, null));
            cache.put(cacheKey, new CachedResult(System.currentTimeMillis() + CACHE_MS, result));
            return result;
        } catch (Exception e) {
            return new Result(List.of(), OperationalFeedService.status("open-meteo", "Open-Meteo forecast models", "weather",
                "degraded", OperationalFeedService.safeMessage(e)));
        }
    }

    public static final int MAX_PAST_DAYS = 4;
    private static final long HISTORY_CACHE_MS = 60 * 60 * 1000;

    public record DayHistory(String key, List<RainfallScoring.DayAssessment> days) {}

    public record HistoryResult(List<DayHistory> history, SourceStatus source) {}

    private final Map<String, CachedHistory> historyCache = new ConcurrentHashMap<>();

    private record CachedHistory(long expiresAt, HistoryResult result) {}

    /** Weather for the last {@link #MAX_PAST_DAYS} complete days per point. Past days do not change, so this caches for an hour. */
    public HistoryResult history(List<Point> points) {
        validate(points);
        String provider = System.getenv().getOrDefault("SAFEGO_WEATHER_PROVIDER", "open-meteo").trim().toLowerCase(Locale.ROOT);
        if (!"open-meteo".equals(provider)) {
            return new HistoryResult(List.of(), OperationalFeedService.status("open-meteo", "Open-Meteo forecast models", "weather",
                "disabled".equals(provider) ? "disabled" : "degraded",
                "disabled".equals(provider) ? null : "SAFEGO_WEATHER_PROVIDER must be open-meteo or disabled."));
        }
        String cacheKey = java.time.LocalDate.now(java.time.ZoneId.of("Asia/Manila")) + "|" + cacheKey(points);
        CachedHistory cached = historyCache.get(cacheKey);
        if (cached != null && cached.expiresAt() > System.currentTimeMillis()) return cached.result();
        try {
            List<List<RainfallScoring.DayAssessment>> fetched = weather.fetchPastDays(
                points.stream().map(point -> new double[] {point.latitude(), point.longitude()}).toList(), MAX_PAST_DAYS);
            List<DayHistory> history = new ArrayList<>();
            for (int i = 0; i < points.size(); i++) history.add(new DayHistory(points.get(i).key(), fetched.get(i)));
            HistoryResult result = new HistoryResult(List.copyOf(history), new SourceStatus("open-meteo",
                "Open-Meteo forecast models", "weather", "active", Instant.now().toString(), null, null));
            if (historyCache.size() > 20) historyCache.clear();
            historyCache.put(cacheKey, new CachedHistory(System.currentTimeMillis() + HISTORY_CACHE_MS, result));
            return result;
        } catch (Exception e) {
            return new HistoryResult(List.of(), OperationalFeedService.status("open-meteo", "Open-Meteo forecast models", "weather",
                "degraded", OperationalFeedService.safeMessage(e)));
        }
    }

    public record HourTimeline(String key, List<RainfallScoring.HourAssessment> hours) {}

    public record TimelineResult(List<HourTimeline> timelines, SourceStatus source) {}

    private final Map<String, CachedTimeline> timelineCache = new ConcurrentHashMap<>();

    private record CachedTimeline(long expiresAt, TimelineResult result) {}

    /** Hour-by-hour weather for the last {@link #MAX_PAST_DAYS} days up to now, per point. Cached for 15 minutes. */
    public TimelineResult timeline(List<Point> points) {
        validate(points);
        String provider = System.getenv().getOrDefault("SAFEGO_WEATHER_PROVIDER", "open-meteo").trim().toLowerCase(Locale.ROOT);
        if (!"open-meteo".equals(provider)) {
            return new TimelineResult(List.of(), OperationalFeedService.status("open-meteo", "Open-Meteo forecast models", "weather",
                "disabled".equals(provider) ? "disabled" : "degraded",
                "disabled".equals(provider) ? null : "SAFEGO_WEATHER_PROVIDER must be open-meteo or disabled."));
        }
        String cacheKey = cacheKey(points);
        CachedTimeline cached = timelineCache.get(cacheKey);
        if (cached != null && cached.expiresAt() > System.currentTimeMillis()) return cached.result();
        try {
            List<List<RainfallScoring.HourAssessment>> fetched = weather.fetchPastHours(
                points.stream().map(point -> new double[] {point.latitude(), point.longitude()}).toList(), MAX_PAST_DAYS);
            List<HourTimeline> timelines = new ArrayList<>();
            for (int i = 0; i < points.size(); i++) timelines.add(new HourTimeline(points.get(i).key(), fetched.get(i)));
            TimelineResult result = new TimelineResult(List.copyOf(timelines), new SourceStatus("open-meteo",
                "Open-Meteo forecast models", "weather", "active", Instant.now().toString(), null, null));
            if (timelineCache.size() > 20) timelineCache.clear();
            timelineCache.put(cacheKey, new CachedTimeline(System.currentTimeMillis() + 15 * 60 * 1000, result));
            return result;
        } catch (Exception e) {
            return new TimelineResult(List.of(), OperationalFeedService.status("open-meteo", "Open-Meteo forecast models", "weather",
                "degraded", OperationalFeedService.safeMessage(e)));
        }
    }

    private static String cacheKey(List<Point> points) {
        StringBuilder key = new StringBuilder();
        for (Point point : points) {
            key.append(point.key()).append('@')
                .append(String.format(Locale.ROOT, "%.3f,%.3f", point.latitude(), point.longitude())).append(';');
        }
        return key.toString();
    }
}
