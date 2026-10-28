package com.safego.demo.data;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.safego.demo.util.GeoUtils;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

/**
 * Archived weather around one documented past moment, served in place of live weather when
 * SAFEGO_REPLAY points to a pack built by `npm run replay:build`. While a replay is on, SafeGo's clock
 * reads the replay moment, and PAGASA alerts and the university scan are switched off, because
 * there is no archive of what they said then.
 */
public final class ReplayPack {

    private static final ZoneId MANILA = ZoneId.of("Asia/Manila");
    /** A request farther than this from every saved point is refused rather than guessed. */
    private static final double MAX_DISTANCE_METERS = 5_000;

    public record Point(String key, double latitude, double longitude, JsonNode hourly, JsonNode daily) {}

    private static volatile ReplayPack configured;
    private static volatile boolean loaded;

    private final String label;
    private final String source;
    private final LocalDateTime at;
    private final List<Point> points;

    private ReplayPack(String label, String source, LocalDateTime at, List<Point> points) {
        this.label = label;
        this.source = source;
        this.at = at;
        this.points = points;
    }

    /** The replay named by SAFEGO_REPLAY, or null for live data. A pack that cannot be read stops the server. */
    public static ReplayPack active() {
        if (!loaded) {
            synchronized (ReplayPack.class) {
                if (!loaded) {
                    String path = System.getenv("SAFEGO_REPLAY");
                    configured = path == null || path.isBlank() ? null : load(Path.of(path.trim()));
                    loaded = true;
                }
            }
        }
        return configured;
    }

    public static boolean isActive() {
        return active() != null;
    }

    /** The replay moment while a replay is on, otherwise the real time. */
    public static Instant now() {
        ReplayPack replay = active();
        return replay == null ? Instant.now() : replay.at.atZone(MANILA).toInstant();
    }

    public static ReplayPack load(Path file) {
        try {
            JsonNode json = new ObjectMapper().readTree(Files.readString(file));
            List<Point> points = new ArrayList<>();
            json.path("points").forEach(point -> points.add(new Point(point.path("key").asText(),
                point.path("latitude").asDouble(), point.path("longitude").asDouble(), point.path("hourly"), point.path("daily"))));
            LocalDateTime at = LocalDateTime.parse(json.path("at").asText());
            if (points.isEmpty()) throw new IllegalStateException("it has no points");
            for (Point point : points) {
                if (indexOf(point.hourly(), at) < 0) throw new IllegalStateException(point.key() + " has no reading at " + at);
            }
            return new ReplayPack(json.path("label").asText(), json.path("source").asText(), at, List.copyOf(points));
        } catch (Exception e) {
            throw new IllegalStateException("Cannot read the replay pack " + file + ": " + e.getMessage(), e);
        }
    }

    public String label() {
        return label;
    }

    public String source() {
        return source;
    }

    public LocalDateTime at() {
        return at;
    }

    public LocalDate today() {
        return at.toLocalDate();
    }

    /** "yyyy-MM-ddTHH:00", the replay hour. */
    public String nowHour() {
        return at.toString().substring(0, 13) + ":00";
    }

    /** The saved point closest to a coordinate. */
    public Point nearest(double latitude, double longitude) {
        Point best = null;
        double bestDistance = Double.MAX_VALUE;
        for (Point point : points) {
            double distance = GeoUtils.distanceKm(new double[] {latitude, longitude}, new double[] {point.latitude(), point.longitude()}) * 1000;
            if (distance < bestDistance) {
                best = point;
                bestDistance = distance;
            }
        }
        if (best == null || bestDistance > MAX_DISTANCE_METERS) {
            throw new IllegalStateException("The replay has no weather saved near this place.");
        }
        return best;
    }

    /** An Open-Meteo style "current" block for the replay hour. */
    public ObjectNode current(Point point) {
        JsonNode hourly = point.hourly();
        int index = indexOf(hourly, at);
        ObjectNode current = new ObjectMapper().createObjectNode();
        current.put("time", nowHour());
        current.put("interval", 3600);
        for (String field : List.of("weather_code", "temperature_2m", "precipitation", "wind_speed_10m", "wind_gusts_10m")) {
            current.set(field, hourly.path(field).path(index));
        }
        return current;
    }

    /** Hourly rain from 24 hours before the replay hour to 3 hours after, as the live request asks for. */
    public ObjectNode rainAround(Point point) {
        JsonNode hourly = point.hourly();
        int index = indexOf(hourly, at);
        ObjectNode slice = new ObjectMapper().createObjectNode();
        ArrayNode times = slice.putArray("time");
        ArrayNode rain = slice.putArray("precipitation");
        for (int i = Math.max(0, index - 24); i <= Math.min(hourly.path("time").size() - 1, index + 3); i++) {
            times.add(hourly.path("time").path(i));
            rain.add(hourly.path("precipitation").path(i));
        }
        return slice;
    }

    private static int indexOf(JsonNode hourly, LocalDateTime at) {
        String hour = at.toString().substring(0, 13) + ":00";
        JsonNode times = hourly.path("time");
        for (int i = 0; i < times.size(); i++) {
            if (hour.equals(times.get(i).asText())) return i;
        }
        return -1;
    }
}
