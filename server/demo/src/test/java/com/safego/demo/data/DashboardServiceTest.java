package com.safego.demo.data;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertEquals;

class DashboardServiceTest {

    @Test
    void weatherScoringStaysLowInCalmAndDryConditions() {
        assertEquals(5, DashboardService.scoreWeather(1, 0, 12));
    }

    @Test
    void heavyHourlyPrecipitationRaisesWeatherSeverity() {
        assertEquals(70, DashboardService.scoreWeather(61, 8, 20));
    }

    @Test
    void severeThunderstormsRemainCriticalRegardlessOfLightModeledRain() {
        assertEquals(95, DashboardService.scoreWeather(99, 1, 30));
        assertEquals("Thunderstorm", DashboardService.weatherLabel(99));
    }

    @Test
    void weatherLabelsMapCorrectly() {
        assertEquals("Clear", DashboardService.weatherLabel(0));
        assertEquals("Partly cloudy", DashboardService.weatherLabel(2));
        assertEquals("Foggy", DashboardService.weatherLabel(45));
        assertEquals("Drizzle", DashboardService.weatherLabel(51));
        assertEquals("Rain", DashboardService.weatherLabel(63));
        assertEquals("Rain showers", DashboardService.weatherLabel(80));
    }
}
