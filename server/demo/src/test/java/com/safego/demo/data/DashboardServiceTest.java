package com.safego.demo.data;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertEquals;

class DashboardServiceTest {
    @Test
    void calmWeatherStaysLow() {
        assertEquals(0, DashboardService.scoreWeather(0, 0, 0));
    }

    @Test
    void precipitationCanRaiseSeverity() {
        assertEquals(70, DashboardService.scoreWeather(1, 8, 10));
    }

    @Test
    void thunderstormCodeDominatesLightRain() {
        assertEquals(95, DashboardService.scoreWeather(99, 0.2, 10));
    }
}
