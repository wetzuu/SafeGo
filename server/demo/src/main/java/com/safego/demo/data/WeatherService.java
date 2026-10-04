package com.safego.demo.data;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.safego.demo.model.Hazard;
import com.safego.demo.model.RiskFactor;
import com.safego.demo.model.SafeGoLocation;
import com.safego.demo.model.Stat;
import org.springframework.stereotype.Service;

import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class WeatherService {

    private static final ZoneId MANILA = ZoneId.of("Asia/Manila");
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("h:mm a", Locale.ENGLISH);
    private static final Object OPEN_METEO_GATE = new Object();
    private static final long MIN_REQUEST_GAP_MS = 900;
    private static long nextOpenMeteoRequestAt;
    private volatile String currentProviderName = "Open-Meteo forecast models";
    private static final String WEATHER_FIELDS =
        "temperature_2m,relative_humidity_2m,precipitation,rain,showers,weather_code,wind_speed_10m,wind_gusts_10m";
    // Rain over the past day and the next three hours, so scoring can see accumulation and what's coming.
    private static final String HOURLY_RAIN = "&hourly=precipitation&past_hours=24&forecast_hours=4";

    /** Weather at one point: the rainfall-aware assessment plus the raw readings shown to people. */
    public record Reading(
        RainfallScoring.Assessment assessment,
        double temperatureCelsius,
        double windSpeedKph,
        double windGustKph,
        String observedAt
    ) {}

    private final ObjectMapper mapper;

    public WeatherService() {
        this(new ObjectMapper());
    }

    public WeatherService(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    /** Rainfall-aware readings for each coordinate ([latitude, longitude]), in the same order. */
    public List<Reading> fetchReadings(List<double[]> coordinates) throws Exception {
        if (coordinates.isEmpty()) return List.of();

        String latitudes = String.join(",", coordinates.stream().map(c -> String.format(Locale.ROOT, "%.4f", c[0])).toList());
        String longitudes = String.join(",", coordinates.stream().map(c -> String.format(Locale.ROOT, "%.4f", c[1])).toList());
        String url = "https://api.open-meteo.com/v1/forecast?latitude=" + latitudes + "&longitude=" + longitudes
            + "&current=" + URLEncoder.encode(WEATHER_FIELDS, StandardCharsets.UTF_8) + HOURLY_RAIN + "&timezone=Asia%2FManila";

        JsonNode payload;
        try {
            payload = request(url);
            currentProviderName = "Open-Meteo forecast models";
        } catch (IllegalStateException error) {
            if (!error.getMessage().contains("HTTP 429") && !error.getMessage().contains("rate limited")) throw error;
            currentProviderName = "MET Norway forecast (Open-Meteo fallback)";
            return fetchMetNorwayReadings(coordinates);
        }
        List<JsonNode> observations = new ArrayList<>();
        if (payload.isArray()) payload.forEach(observations::add);
        else observations.add(payload);

        if (observations.size() != coordinates.size()) {
            throw new IllegalStateException("Open-Meteo returned an unexpected number of locations.");
        }

        List<Reading> readings = new ArrayList<>();
        for (JsonNode observation : observations) {
            JsonNode current = observation.path("current");
            for (String field : List.of("weather_code", "temperature_2m", "precipitation", "wind_speed_10m", "wind_gusts_10m")) {
                if (!current.path(field).isNumber()) {
                    throw new IllegalStateException("Open-Meteo response is missing current weather fields.");
                }
            }
            String time = current.path("time").asText();
            readings.add(new Reading(
                RainfallScoring.assess(current, observation.path("hourly")),
                current.path("temperature_2m").asDouble(),
                current.path("wind_speed_10m").asDouble(),
                current.path("wind_gusts_10m").asDouble(),
                time.length() == 16 ? time + ":00+08:00" : time + "+08:00"
            ));
        }
        return readings;
    }

    public String currentProviderName() {
        return currentProviderName;
    }

    /** Current global forecast fallback used only while Open-Meteo is rate limited. */
    private List<Reading> fetchMetNorwayReadings(List<double[]> coordinates) throws Exception {
        List<Reading> readings = new ArrayList<>();
        for (double[] coordinate : coordinates) {
            String url = String.format(Locale.ROOT,
                "https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=%.4f&lon=%.4f",
                coordinate[0], coordinate[1]);
            JsonNode payload = requestMetNorway(url);
            JsonNode timeseries = payload.path("properties").path("timeseries");
            if (!timeseries.isArray() || timeseries.isEmpty()) {
                throw new IllegalStateException("MET Norway response is missing forecast data.");
            }

            JsonNode first = timeseries.get(0);
            JsonNode details = first.path("data").path("instant").path("details");
            if (!details.path("air_temperature").isNumber() || !details.path("wind_speed").isNumber()) {
                throw new IllegalStateException("MET Norway response is missing current weather fields.");
            }

            double windSpeedKph = details.path("wind_speed").asDouble() * 3.6;
            double gustKph = details.path("wind_speed_of_gust").asDouble(details.path("wind_speed").asDouble()) * 3.6;
            double currentRain = precipitation(first);
            int weatherCode = metNorwayWeatherCode(first.path("data").path("next_1_hours").path("summary").path("symbol_code").asText());

            ObjectNode current = mapper.createObjectNode();
            current.put("time", first.path("time").asText());
            current.put("interval", 3600);
            current.put("weather_code", weatherCode);
            current.put("temperature_2m", details.path("air_temperature").asDouble());
            current.put("precipitation", currentRain);
            current.put("wind_speed_10m", windSpeedKph);
            current.put("wind_gusts_10m", gustKph);

            ObjectNode hourly = mapper.createObjectNode();
            var times = hourly.putArray("time");
            var rain = hourly.putArray("precipitation");
            String currentHour = first.path("time").asText().substring(0, 13) + ":00";
            times.add(currentHour);
            rain.add(0);
            for (int index = 1; index < Math.min(4, timeseries.size()); index++) {
                JsonNode hour = timeseries.get(index);
                times.add(hour.path("time").asText().substring(0, 13) + ":00");
                rain.add(precipitation(hour));
            }

            readings.add(new Reading(
                RainfallScoring.assess(current, hourly),
                details.path("air_temperature").asDouble(),
                windSpeedKph,
                gustKph,
                first.path("time").asText()
            ));
        }
        return readings;
    }

    private JsonNode requestMetNorway(String url) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) URI.create(url).toURL().openConnection();
        connection.setConnectTimeout(10_000);
        connection.setReadTimeout(15_000);
        connection.setRequestProperty("Accept", "application/json");
        connection.setRequestProperty("User-Agent", "SafeGo/0.1 local-development");
        try {
            int code = connection.getResponseCode();
            if (code < 200 || code >= 300) throw new IllegalStateException("Weather fallback returned HTTP " + code + ".");
            try (var body = connection.getInputStream()) {
                return mapper.readTree(body);
            }
        } finally {
            connection.disconnect();
        }
    }

    private static double precipitation(JsonNode hour) {
        return hour.path("data").path("next_1_hours").path("details").path("precipitation_amount").asDouble(0);
    }

    private static int metNorwayWeatherCode(String symbol) {
        String value = symbol.toLowerCase(Locale.ROOT);
        if (value.contains("thunder")) return 95;
        if (value.contains("heavyrain")) return 65;
        if (value.contains("rainshowers")) return 80;
        if (value.contains("rain")) return 61;
        if (value.contains("fog")) return 45;
        if (value.contains("cloudy")) return 3;
        if (value.contains("fair")) return 1;
        return 0;
    }

    /** Scored weather for every hour of the last {@code days} days up to now, oldest first, at each coordinate. */
    public List<List<RainfallScoring.HourAssessment>> fetchPastHours(List<double[]> coordinates, int days) throws Exception {
        if (coordinates.isEmpty()) return List.of();
        String latitudes = String.join(",", coordinates.stream().map(c -> String.format(Locale.ROOT, "%.4f", c[0])).toList());
        String longitudes = String.join(",", coordinates.stream().map(c -> String.format(Locale.ROOT, "%.4f", c[1])).toList());
        String url = "https://api.open-meteo.com/v1/forecast?latitude=" + latitudes + "&longitude=" + longitudes
            + "&hourly=" + URLEncoder.encode("weather_code,precipitation,wind_gusts_10m,temperature_2m", StandardCharsets.UTF_8)
            + "&past_days=" + days + "&forecast_days=1&timezone=Asia%2FManila";

        JsonNode payload = request(url);
        List<JsonNode> results = new ArrayList<>();
        if (payload.isArray()) payload.forEach(results::add);
        else results.add(payload);
        if (results.size() != coordinates.size()) {
            throw new IllegalStateException("Open-Meteo returned an unexpected number of locations.");
        }

        String nowHour = java.time.LocalDateTime.now(MANILA).withMinute(0).withSecond(0).withNano(0).toString().substring(0, 16);
        List<List<RainfallScoring.HourAssessment>> timelines = new ArrayList<>();
        for (JsonNode result : results) timelines.add(RainfallScoring.assessHours(result.path("hourly"), nowHour));
        return timelines;
    }

    /** Scored weather for up to {@code days} complete past days at each coordinate, newest day first. */
    public List<List<RainfallScoring.DayAssessment>> fetchPastDays(List<double[]> coordinates, int days) throws Exception {
        if (coordinates.isEmpty()) return List.of();
        String latitudes = String.join(",", coordinates.stream().map(c -> String.format(Locale.ROOT, "%.4f", c[0])).toList());
        String longitudes = String.join(",", coordinates.stream().map(c -> String.format(Locale.ROOT, "%.4f", c[1])).toList());
        String url = "https://api.open-meteo.com/v1/forecast?latitude=" + latitudes + "&longitude=" + longitudes
            + "&daily=" + URLEncoder.encode("weather_code,precipitation_sum,temperature_2m_max,temperature_2m_min,wind_gusts_10m_max", StandardCharsets.UTF_8)
            + "&hourly=precipitation&past_days=" + days + "&forecast_days=1&timezone=Asia%2FManila";

        JsonNode payload = request(url);
        List<JsonNode> results = new ArrayList<>();
        if (payload.isArray()) payload.forEach(results::add);
        else results.add(payload);
        if (results.size() != coordinates.size()) {
            throw new IllegalStateException("Open-Meteo returned an unexpected number of locations.");
        }

        String today = java.time.LocalDate.now(MANILA).toString();
        List<List<RainfallScoring.DayAssessment>> history = new ArrayList<>();
        for (JsonNode result : results) {
            history.add(RainfallScoring.assessPastDays(result.path("daily"), result.path("hourly"), today, days));
        }
        return history;
    }

    public List<SafeGoLocation> fetchAndApplyWeather(List<SafeGoLocation> locations) throws Exception {
        if (locations.isEmpty()) return locations;

        List<Reading> readings = fetchReadings(locations.stream().map(SafeGoLocation::coordinates).toList());

        List<SafeGoLocation> result = new ArrayList<>();
        for (int index = 0; index < locations.size(); index++) {
            Reading reading = readings.get(index);
            RainfallScoring.Assessment assessment = reading.assessment();
            double gust = reading.windGustKph();
            double temp = reading.temperatureCelsius();

            String condition = assessment.condition();
            int score = assessment.score();
            String description = RainfallScoring.describe(assessment, reading.windSpeedKph(), gust);

            SafeGoLocation location = locations.get(index);
            RiskFactor factor = new RiskFactor(
                "Weather", score, bandKey(score), bandLabel(score), description, "weather", "icon-weather"
            );

            List<Stat> stats = location.stats().stream().map(s -> s.label().equals("Weather")
                ? new Stat(s.label(), condition + ", " + Math.round(temp) + "°C",
                    String.format(Locale.ENGLISH, "%.1f mm last 3 h · gusts %d km/h", assessment.pastThreeHoursMm(), Math.round(gust)), s.icon(), s.tone())
                : s).toList();

            String summary = "The latest weather estimate is included in this result. Other factors use the most recent information available to SafeGo.";
            String updated = TIME.format(OffsetDateTime.parse(reading.observedAt()).atZoneSameInstant(MANILA));

            result.add(copy(location, updated, summary, stats, replace(location.factors(), factor)));
        }
        return result;
    }

    private JsonNode request(String url) throws Exception {
        // The map, dashboard and four-day timeline can initialize together. Serialize those calls
        // and honor 429 Retry-After responses instead of sending a burst that extends throttling.
        synchronized (OPEN_METEO_GATE) {
            for (int attempt = 0; attempt < 3; attempt++) {
                waitForOpenMeteoSlot();
                HttpURLConnection connection = (HttpURLConnection) URI.create(url).toURL().openConnection();
                connection.setConnectTimeout(10_000);
                connection.setReadTimeout(15_000);
                connection.setRequestProperty("Accept", "application/json");
                connection.setRequestProperty("User-Agent", "SafeGo/0.1 (weather; contact in app configuration)");
                try {
                    int code = connection.getResponseCode();
                    nextOpenMeteoRequestAt = System.currentTimeMillis() + MIN_REQUEST_GAP_MS;
                    if (code == 429 && attempt < 2) {
                        nextOpenMeteoRequestAt = System.currentTimeMillis() + retryAfterMillis(connection, attempt);
                        continue;
                    }
                    if (code < 200 || code >= 300) {
                        throw new IllegalStateException("Source returned HTTP " + code + ".");
                    }
                    try (var body = connection.getInputStream()) {
                        return mapper.readTree(body);
                    }
                } finally {
                    connection.disconnect();
                }
            }
            throw new IllegalStateException("Open-Meteo remained rate limited after retrying.");
        }
    }

    private static void waitForOpenMeteoSlot() throws InterruptedException {
        long wait = nextOpenMeteoRequestAt - System.currentTimeMillis();
        if (wait > 0) {
            try {
                Thread.sleep(wait);
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
                throw interrupted;
            }
        }
    }

    private static long retryAfterMillis(HttpURLConnection connection, int attempt) {
        String value = connection.getHeaderField("Retry-After");
        if (value != null) {
            try {
                return Math.clamp(Long.parseLong(value.trim()) * 1_000, 1_000, 15_000);
            } catch (NumberFormatException ignored) {
                // Fall back to a short exponential delay when the header is an HTTP date.
            }
        }
        return 1_500L << attempt;
    }

    public static int scoreWeather(int code, double rain, double gust) {
        return Math.max(codeScore(code), Math.max(rainScore(rain), gustScore(gust)));
    }

    public static String weatherLabel(int code) {
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

    static int rainScore(double value) {
        return value >= 15 ? 90 : value >= 7.5 ? 70 : value >= 2.5 ? 45 : value >= .5 ? 25 : value >= .1 ? 10 : 0;
    }

    static int gustScore(double value) {
        return value >= 100 ? 95 : value >= 75 ? 75 : value >= 50 ? 55 : value >= 35 ? 35 : value >= 20 ? 15 : 0;
    }

    static int codeScore(int code) {
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

    private static String bandKey(int score) {
        return score <= 29 ? "low" : score <= 59 ? "mod" : score <= 79 ? "high" : "crit";
    }

    private static String bandLabel(int score) {
        return score <= 29 ? "Low" : score <= 59 ? "Moderate" : score <= 79 ? "High" : "Critical";
    }

    private static List<RiskFactor> replace(List<RiskFactor> factors, RiskFactor replacement) {
        return factors.stream().map(f -> f.name().equals(replacement.name()) ? replacement : f).toList();
    }

    private static SafeGoLocation copy(
            SafeGoLocation source, String updated, String summary, List<Stat> stats, List<RiskFactor> factors) {
        return new SafeGoLocation(
            source.id(), source.name(), source.city(), source.aliases(), source.coordinates(), updated,
            summary, source.riskStatus(), stats, factors, source.advisories(), source.universities(),
            source.reports(), source.points(), source.floods(), source.hazards(),
            RiskModel.analyzeRisk(factors, summary, source.riskStatus())
        );
    }
}
