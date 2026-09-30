package com.safego.demo.data;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class RainfallScoringTest {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    /** 24 past hours, the hour that just ended (stamped 12:00) and 3 forecast hours, like Open-Meteo returns. */
    private static JsonNode hourly(double[] past24, double lastHour, double[] next3) {
        List<String> times = new ArrayList<>();
        List<Double> rain = new ArrayList<>();
        for (int i = 0; i < 24; i++) {
            // 12:00 yesterday through 11:00 today.
            times.add(i < 12 ? String.format("2026-09-29T%02d:00", 12 + i) : String.format("2026-09-30T%02d:00", i - 12));
            rain.add(past24[i]);
        }
        times.add("2026-09-30T12:00");
        rain.add(lastHour);
        for (int i = 0; i < 3; i++) {
            times.add(String.format("2026-09-30T%02d:00", 13 + i));
            rain.add(next3[i]);
        }
        return MAPPER.valueToTree(Map.of("time", times, "precipitation", rain));
    }

    private static JsonNode current(int code, double precipitation, double gust) {
        return MAPPER.valueToTree(Map.of("time", "2026-09-30T12:30", "interval", 900,
            "weather_code", code, "precipitation", precipitation, "wind_gusts_10m", gust));
    }

    @Test
    void calmWeatherStaysLow() {
        var a = RainfallScoring.assess(current(1, 0, 10), hourly(new double[24], 0, new double[3]));
        assertEquals(5, a.score());
        assertEquals("sky", a.driver());
        assertNull(a.pagasaLevel());
    }

    @Test
    void currentPrecipitationIsConvertedFromFifteenMinutesToAnHourlyRate() {
        // 2 mm in 15 minutes is 8 mm/h, which is PAGASA-yellow territory, not light rain.
        var a = RainfallScoring.assess(current(61, 2, 10), hourly(new double[24], 0, new double[3]));
        assertEquals(8.0, a.currentRateMmPerHour());
        assertEquals(70, a.score());
        assertEquals("yellow", a.pagasaLevel());
    }

    @Test
    void heavyRainInTheLastThreeHoursKeepsTheScoreHighAfterItStops() {
        double[] past = new double[24];
        past[22] = 30;
        past[23] = 25;
        var a = RainfallScoring.assess(current(3, 0, 10), hourly(past, 12, new double[3]));
        assertEquals(67.0, a.pastThreeHoursMm());
        assertEquals(90, a.score());
        assertEquals("three-hour-total", a.driver());
        assertEquals("red", a.pagasaLevel());
    }

    @Test
    void forecastRainRaisesTheScoreButNotThePagasaLevel() {
        var a = RainfallScoring.assess(current(3, 0, 10), hourly(new double[24], 0, new double[] {0, 16, 4}));
        assertEquals(20.0, a.nextThreeHoursMm());
        assertEquals(90, a.score());
        assertEquals("forecast", a.driver());
        assertNull(a.pagasaLevel(), "PAGASA levels describe observed rain only");
    }

    @Test
    void pastDayTotalIsReported() {
        double[] past = new double[24];
        past[0] = 40; // 25 hours ago: outside the last 24 hours
        past[1] = 10;
        past[5] = 5;
        var a = RainfallScoring.assess(current(3, 0, 10), hourly(past, 1, new double[3]));
        assertEquals(16.0, a.pastDayMm());
    }

    /** Open-Meteo past_days shape: daily arrays plus 24 hourly values per day. */
    private static JsonNode[] pastDays(String[] dates, int[] codes, double[][] hourlyRain) {
        List<String> times = new ArrayList<>();
        List<Double> rain = new ArrayList<>();
        List<Double> sums = new ArrayList<>();
        for (int d = 0; d < dates.length; d++) {
            double sum = 0;
            for (int h = 0; h < 24; h++) {
                times.add(String.format("%sT%02d:00", dates[d], h));
                double value = h < hourlyRain[d].length ? hourlyRain[d][h] : 0;
                rain.add(value);
                sum += value;
            }
            sums.add(sum);
        }
        List<Integer> codeList = new ArrayList<>();
        for (int code : codes) codeList.add(code);
        List<Double> filler = new ArrayList<>(java.util.Collections.nCopies(dates.length, 20.0));
        JsonNode daily = MAPPER.valueToTree(Map.of("time", List.of(dates), "weather_code", codeList,
            "precipitation_sum", sums, "temperature_2m_max", filler, "temperature_2m_min", filler,
            "wind_gusts_10m_max", new ArrayList<>(java.util.Collections.nCopies(dates.length, 10.0))));
        JsonNode hourly = MAPPER.valueToTree(Map.of("time", times, "precipitation", rain));
        return new JsonNode[] {daily, hourly};
    }

    @Test
    void pastDaysAreScoredNewestFirstAndExcludeToday() {
        String[] dates = {"2026-09-26", "2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01"};
        var data = pastDays(dates, new int[] {1, 1, 1, 1, 1, 95}, new double[6][0]);
        var days = RainfallScoring.assessPastDays(data[0], data[1], "2026-10-01", 4);
        assertEquals(List.of("2026-09-30", "2026-09-29", "2026-09-28", "2026-09-27"),
            days.stream().map(RainfallScoring.DayAssessment::date).toList(), "today is excluded; at most 4 days");
        assertEquals(5, days.get(0).score());
    }

    @Test
    void aDayWithHeavyThreeHourRainMeetsPagasaRed() {
        double[][] rain = new double[2][];
        rain[0] = new double[] {0, 0, 25, 25, 20};
        rain[1] = new double[0];
        var data = pastDays(new String[] {"2026-09-29", "2026-10-01"}, new int[] {63, 1}, rain);
        var day = RainfallScoring.assessPastDays(data[0], data[1], "2026-10-01", 4).get(0);
        assertEquals(70.0, day.peakThreeHoursMm());
        assertEquals(90, day.score());
        assertEquals("red", day.pagasaLevel());
        assertEquals(70.0, day.rainMm());
    }

    @Test
    void hoursAreScoredUpToNowWithThreeHourTotals() {
        List<String> times = List.of("2026-09-29T14:00", "2026-09-29T15:00", "2026-09-29T16:00", "2026-09-29T17:00");
        JsonNode hourly = MAPPER.valueToTree(Map.of(
            "time", times,
            "weather_code", List.of(3, 95, 63, 3),
            "precipitation", List.of(30.0, 25.0, 12.0, 0.0),
            "wind_gusts_10m", List.of(10.0, 40.0, 10.0, 10.0),
            "temperature_2m", List.of(30.0, 28.0, 27.0, 27.0)));
        var hours = RainfallScoring.assessHours(hourly, "2026-09-29T16:00");
        assertEquals(3, hours.size(), "hours after now are left out");
        assertEquals("orange", hours.get(1).pagasaLevel());
        assertEquals(67.0, hours.get(2).threeHourMm(), "12 mm alone scores 70; the 3-hour total pushes it to 90");
        assertEquals(90, hours.get(2).score());
        assertEquals("three-hour-total", hours.get(2).driver());
        assertEquals("red", hours.get(2).pagasaLevel());
    }

    @Test
    void areaPointsOutsideMetroManilaAreRejected() {
        assertThrows(IllegalArgumentException.class,
            () -> AreaWeatherService.validate(List.of(new AreaWeatherService.Point("cebu", 10.3, 123.9))));
        assertDoesNotThrow(
            () -> AreaWeatherService.validate(List.of(new AreaWeatherService.Point("Quezon City", 14.65, 121.05))));
    }
}
