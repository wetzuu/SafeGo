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

    /** One past day's weather, scored with the same rules as today's reading. */
    public record DayAssessment(
        String date,
        int score,
        /** What set the score: "sky", "wind", "peak-hour" or "three-hour-total". */
        String driver,
        String condition,
        double rainMm,
        double peakHourMm,
        double peakThreeHoursMm,
        double temperatureMaxCelsius,
        double temperatureMinCelsius,
        double gustMaxKph,
        /** The PAGASA rainfall threshold the day's rain met; null if none. */
        String pagasaLevel
    ) {}

    /**
     * Scores each complete day before {@code today} (at most {@code maxDays}, newest first) from
     * Open-Meteo "daily" (weather_code, precipitation_sum, temperature_2m_max/min, wind_gusts_10m_max)
     * and "hourly" precipitation requested with past_days.
     */
    public static List<DayAssessment> assessPastDays(JsonNode daily, JsonNode hourly, String today, int maxDays) {
        List<String> hourTimes = new ArrayList<>();
        List<Double> hourRain = new ArrayList<>();
        hourly.path("time").forEach(node -> hourTimes.add(node.asText()));
        hourly.path("precipitation").forEach(node -> hourRain.add(node.isNumber() ? node.asDouble() : 0));

        List<DayAssessment> days = new ArrayList<>();
        JsonNode dates = daily.path("time");
        for (int i = dates.size() - 1; i >= 0 && days.size() < maxDays; i--) {
            String date = dates.get(i).asText();
            if (date.compareTo(today) >= 0) continue;

            List<Double> rain = new ArrayList<>();
            for (int h = 0; h < hourTimes.size(); h++) {
                if (hourTimes.get(h).startsWith(date)) rain.add(h < hourRain.size() ? hourRain.get(h) : 0);
            }
            double peakHour = max(rain, 0, rain.size());
            double peakThree = 0;
            for (int h = 0; h < rain.size(); h++) peakThree = Math.max(peakThree, sum(rain, h - 2, h + 1));

            int code = daily.path("weather_code").path(i).asInt();
            double gust = daily.path("wind_gusts_10m_max").path(i).asDouble();
            int sky = WeatherService.codeScore(code);
            int wind = WeatherService.gustScore(gust);
            int hourScore = WeatherService.rainScore(peakHour);
            int threeHourScore = peakThree > RED_THREE_HOUR_MM ? 90 : 0;

            int score = sky;
            String driver = "sky";
            if (wind > score) { score = wind; driver = "wind"; }
            if (hourScore > score) { score = hourScore; driver = "peak-hour"; }
            if (threeHourScore > score) { score = threeHourScore; driver = "three-hour-total"; }

            String level = peakHour > 30 || peakThree > RED_THREE_HOUR_MM ? "red"
                : peakHour >= 15 ? "orange"
                : peakHour >= 7.5 ? "yellow"
                : null;

            days.add(new DayAssessment(date, score, driver, WeatherService.weatherLabel(code),
                round(daily.path("precipitation_sum").path(i).asDouble()), round(peakHour), round(peakThree),
                round(daily.path("temperature_2m_max").path(i).asDouble()),
                round(daily.path("temperature_2m_min").path(i).asDouble()), round(gust), level));
        }
        return days;
    }

    /** Weather in one past hour, scored with today's rules (without the forecast part: it already happened). */
    public record HourAssessment(
        String time,
        int score,
        /** What set the score: "sky", "wind", "past-hour" or "three-hour-total". */
        String driver,
        String condition,
        double rainMm,
        double threeHourMm,
        double temperatureCelsius,
        double gustKph,
        /** The PAGASA rainfall threshold the hour's rain met; null if none. */
        String pagasaLevel
    ) {}

    /**
     * Scores every hour up to and including {@code nowHour} ("yyyy-MM-ddTHH:00") from Open-Meteo "hourly"
     * weather_code, precipitation, wind_gusts_10m and temperature_2m (each value covers the preceding hour).
     */
    public static List<HourAssessment> assessHours(JsonNode hourly, String nowHour) {
        List<String> times = new ArrayList<>();
        List<Double> rain = new ArrayList<>();
        hourly.path("time").forEach(node -> times.add(node.asText()));
        hourly.path("precipitation").forEach(node -> rain.add(node.isNumber() ? node.asDouble() : 0));

        List<HourAssessment> hours = new ArrayList<>();
        for (int i = 0; i < times.size(); i++) {
            String time = times.get(i);
            if (time.compareTo(nowHour) > 0) break;
            int code = hourly.path("weather_code").path(i).asInt();
            double gust = hourly.path("wind_gusts_10m").path(i).asDouble();
            double hourRain = i < rain.size() ? rain.get(i) : 0;
            double three = sum(rain, i - 2, i + 1);

            int score = WeatherService.codeScore(code);
            String driver = "sky";
            int wind = WeatherService.gustScore(gust);
            int rainScore = WeatherService.rainScore(hourRain);
            int threeScore = three > RED_THREE_HOUR_MM ? 90 : 0;
            if (wind > score) { score = wind; driver = "wind"; }
            if (rainScore > score) { score = rainScore; driver = "past-hour"; }
            if (threeScore > score) { score = threeScore; driver = "three-hour-total"; }

            String level = hourRain > 30 || three > RED_THREE_HOUR_MM ? "red"
                : hourRain >= 15 ? "orange"
                : hourRain >= 7.5 ? "yellow"
                : null;
            hours.add(new HourAssessment(time, score, driver, WeatherService.weatherLabel(code), round(hourRain), round(three),
                round(hourly.path("temperature_2m").path(i).asDouble()), round(gust), level));
        }
        return hours;
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
