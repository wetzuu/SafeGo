package com.safego.demo.data;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Scores Open-Meteo weather using rain over time, not just the current moment.
 *
 * <p>Metro Manila flooding follows accumulated rain, so a dry quarter-hour after a downpour must not
 * read as calm. The score is the highest of: current sky/rain rate/gusts, the last hour's rain,
 * the last three hours' total (PAGASA's red threshold is more than 65 mm in 3 hours), and forecast
 * rain over the next three hours. PAGASA levels here are model-based equivalents of its published
 * rainfall thresholds, not official PAGASA warnings.
 */
public final class RainfallScoring {

    public static final double RED_THREE_HOUR_MM = 65;

    private RainfallScoring() {}

    public record Assessment(
        int score,
        /** What set the score: "sky", "current-rain", "wind", "past-hour", "three-hour-total" or "forecast". */
        String driver,
        String condition,
        double currentRateMmPerHour,
        double lastHourMm,
        double pastThreeHoursMm,
        double pastDayMm,
        double nextThreeHoursMm,
        double nextHourMaxMm,
        /** "yellow", "orange" or "red" when observed rain meets that PAGASA threshold; null otherwise. */
        String pagasaLevel
    ) {}

    /**
     * @param current   Open-Meteo "current" block: weather_code, precipitation, wind_gusts_10m, interval, time
     * @param hourly    Open-Meteo "hourly" block with time and precipitation, requested with past_hours=24
     *                  and forecast_hours=4 (each hourly value is the rain of the preceding hour)
     */
    public static Assessment assess(JsonNode current, JsonNode hourly) {
        int code = current.path("weather_code").asInt();
        double gust = current.path("wind_gusts_10m").asDouble();
        double interval = current.path("interval").asDouble(3600);
        // Open-Meteo's current precipitation covers only the last `interval` seconds (usually 15 minutes).
        double rate = current.path("precipitation").asDouble() * 3600 / Math.max(60, interval);

        List<String> times = new ArrayList<>();
        List<Double> rain = new ArrayList<>();
        hourly.path("time").forEach(node -> times.add(node.asText()));
        hourly.path("precipitation").forEach(node -> rain.add(node.isNumber() ? node.asDouble() : 0));

        // The hourly entry stamped with the current hour holds the rain of the hour that just ended.
        String currentTime = current.path("time").asText();
        String currentHour = currentTime.length() >= 13 ? currentTime.substring(0, 13) + ":00" : currentTime;
        int now = times.indexOf(currentHour);
        if (now < 0) now = Math.max(0, times.size() - 5);

        double lastHour = sum(rain, now, now + 1);
        double pastThree = sum(rain, now - 2, now + 1);
        double pastDay = sum(rain, now - 23, now + 1);
        double nextThree = sum(rain, now + 1, now + 4);
        double nextMax = max(rain, now + 1, now + 4);

        int sky = WeatherService.codeScore(code);
        int currentRain = WeatherService.rainScore(rate);
        int wind = WeatherService.gustScore(gust);
        int pastHourScore = WeatherService.rainScore(lastHour);
        int threeHourScore = pastThree > RED_THREE_HOUR_MM ? 90 : 0;
        int forecastScore = WeatherService.rainScore(nextMax);

        int score = sky;
        String driver = "sky";
        if (currentRain > score) { score = currentRain; driver = "current-rain"; }
        if (wind > score) { score = wind; driver = "wind"; }
        if (pastHourScore > score) { score = pastHourScore; driver = "past-hour"; }
        if (threeHourScore > score) { score = threeHourScore; driver = "three-hour-total"; }
        if (forecastScore > score) { score = forecastScore; driver = "forecast"; }

        double observedHourly = Math.max(rate, lastHour);
        String level = observedHourly > 30 || pastThree > RED_THREE_HOUR_MM ? "red"
            : observedHourly >= 15 ? "orange"
            : observedHourly >= 7.5 ? "yellow"
            : null;

        return new Assessment(score, driver, WeatherService.weatherLabel(code), round(rate), round(lastHour),
            round(pastThree), round(pastDay), round(nextThree), round(nextMax), level);
    }

    /** A plain-language summary, e.g. for a location's weather factor description. */
    public static String describe(Assessment assessment, double windKph, double gustKph) {
        return String.format(Locale.ENGLISH,
            "%s. Rain now %.1f mm/h, last 3 h %.1f mm, last 24 h %.1f mm, next 3 h %.1f mm forecast. "
                + "Winds %d km/h, gusts %d km/h. Open-Meteo model estimate.",
            assessment.condition(), assessment.currentRateMmPerHour(), assessment.pastThreeHoursMm(),
            assessment.pastDayMm(), assessment.nextThreeHoursMm(), Math.round(windKph), Math.round(gustKph));
    }

    private static double sum(List<Double> values, int from, int to) {
        double total = 0;
        for (int i = Math.max(0, from); i < Math.min(values.size(), to); i++) total += values.get(i);
        return total;
    }

    private static double max(List<Double> values, int from, int to) {
        double highest = 0;
        for (int i = Math.max(0, from); i < Math.min(values.size(), to); i++) highest = Math.max(highest, values.get(i));
        return highest;
    }

    private static double round(double value) {
        return Math.round(value * 10) / 10.0;
    }
}
