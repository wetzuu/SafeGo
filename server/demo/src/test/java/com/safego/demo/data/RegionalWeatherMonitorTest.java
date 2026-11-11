package com.safego.demo.data;

import com.safego.demo.model.RiskFactor;
import com.safego.demo.model.SafeGoLocation;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RegionalWeatherMonitorTest {

    private static final Instant T0 = Instant.parse("2026-11-11T00:00:00Z");

    private static SafeGoLocation place(String name, double lat, double lon, int weather) {
        List<RiskFactor> factors = List.of(new RiskFactor("Weather", weather, "low", "Low", "x", "weather", "x"));
        return new SafeGoLocation(name, name, "Manila", List.of(), new double[] {lat, lon}, "now", "", "", List.of(), factors,
            List.of(), List.of(), List.of(), List.of(), List.of(), List.of(), RiskModel.analyzeRisk(factors, "", ""));
    }

    private static RegionalWeatherMonitor.Reading reading(RegionalWeatherMonitor.State state) {
        return new RegionalWeatherMonitor.Reading(state, state.name());
    }

    @Test
    void classifiesTheWorstWeatherInsideTheZonesOnly() {
        SafeGoLocation espana = place("España", 14.612, 120.9902, 40);
        SafeGoLocation farAway = place("Muntinlupa", 14.38, 121.04, 90);
        var reading = RegionalWeatherMonitor.classify(List.of(espana, farAway), false, UniversityAnnouncementService::inCampusZone);
        assertEquals(RegionalWeatherMonitor.State.LIGHT_RAIN, reading.state());
        assertTrue(reading.reason().contains("España"));
        assertEquals(RegionalWeatherMonitor.State.SEVERE,
            RegionalWeatherMonitor.classify(List.of(place("UST", 14.6096, 120.9894, 70)), false, p -> true).state());
        assertEquals(RegionalWeatherMonitor.State.CLEAR,
            RegionalWeatherMonitor.classify(List.of(place("UST", 14.6096, 120.9894, 5)), false, p -> true).state());
        assertEquals(RegionalWeatherMonitor.State.LIGHT_RAIN,
            RegionalWeatherMonitor.classify(List.of(place("UST", 14.6096, 120.9894, 5)), true, p -> true).state(),
            "a PAGASA alert counts as escalated");
    }

    @Test
    void firesOnlyWhenTheWeatherGetsWorse() {
        RegionalWeatherMonitor monitor = new RegionalWeatherMonitor();
        assertTrue(monitor.observe(reading(RegionalWeatherMonitor.State.CLEAR), T0).isEmpty());
        var rain = monitor.observe(reading(RegionalWeatherMonitor.State.LIGHT_RAIN), T0.plusSeconds(60));
        assertTrue(rain.isPresent());
        assertEquals(RegionalWeatherMonitor.State.CLEAR, rain.get().from());
        assertTrue(monitor.observe(reading(RegionalWeatherMonitor.State.LIGHT_RAIN), T0.plusSeconds(120)).isEmpty(), "staying rainy is not a transition");
    }

    @Test
    void debouncesForThirtyMinutes() {
        RegionalWeatherMonitor monitor = new RegionalWeatherMonitor();
        assertTrue(monitor.observe(reading(RegionalWeatherMonitor.State.LIGHT_RAIN), T0).isPresent());
        monitor.observe(reading(RegionalWeatherMonitor.State.CLEAR), T0.plus(Duration.ofMinutes(5)));
        assertFalse(monitor.observe(reading(RegionalWeatherMonitor.State.SEVERE), T0.plus(Duration.ofMinutes(10))).isPresent(),
            "flicker within 30 minutes does not fire again");
        monitor.observe(reading(RegionalWeatherMonitor.State.CLEAR), T0.plus(Duration.ofMinutes(20)));
        var later = monitor.observe(reading(RegionalWeatherMonitor.State.SEVERE), T0.plus(Duration.ofMinutes(31)));
        assertTrue(later.isPresent());
        assertEquals(RegionalWeatherMonitor.State.SEVERE, later.get().to());
    }

    @Test
    void theFirstReadingInAStormCountsAsEscalation() {
        RegionalWeatherMonitor monitor = new RegionalWeatherMonitor();
        assertTrue(monitor.observe(reading(RegionalWeatherMonitor.State.SEVERE), T0).isPresent());
    }
}
