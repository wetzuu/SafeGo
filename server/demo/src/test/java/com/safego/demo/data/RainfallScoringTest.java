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

    @Test
    void areaPointsOutsideMetroManilaAreRejected() {
        assertThrows(IllegalArgumentException.class,
            () -> AreaWeatherService.validate(List.of(new AreaWeatherService.Point("cebu", 10.3, 123.9))));
        assertDoesNotThrow(
            () -> AreaWeatherService.validate(List.of(new AreaWeatherService.Point("Quezon City", 14.65, 121.05))));
    }
}
