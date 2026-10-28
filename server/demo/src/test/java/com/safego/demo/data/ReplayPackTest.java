package com.safego.demo.data;

import org.junit.jupiter.api.Test;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class ReplayPackTest {

    private static final ReplayPack PACK = ReplayPack.load(Path.of("../../data/replay/2026-08-17.json"));

    @Test
    void readsTheSavedMomentAndItsSource() {
        assertEquals("2026-08-17T12:00", PACK.nowHour());
        assertEquals("2026-08-17", PACK.today().toString());
        assertTrue(PACK.source().startsWith("https://"));
        assertFalse(PACK.label().isBlank());
    }

    @Test
    void scoresTheReplayHourWithTheLiveRules() {
        ReplayPack.Point espana = PACK.nearest(14.612, 120.9902);
        var assessment = RainfallScoring.assess(PACK.current(espana), PACK.rainAround(espana));

        assertEquals("2026-08-17T12:00", PACK.current(espana).path("time").asText());
        assertEquals(28, PACK.rainAround(espana).path("time").size(), "24 hours before, the replay hour and 3 after");
        assertTrue(assessment.score() >= 60, "the flash-flood hour rates High or above, got " + assessment.score());
    }

    @Test
    void refusesPlacesFarFromEverySavedPoint() {
        assertThrows(IllegalStateException.class, () -> PACK.nearest(10.3157, 123.8854)); // Cebu
    }

    @Test
    void refusesAPackWithoutTheReplayHour() {
        assertThrows(IllegalStateException.class, () -> ReplayPack.load(Path.of("../../data/backtest/events.json")));
    }
}
