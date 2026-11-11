package com.safego.demo.events;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SafeGoEventBusTest {

    @Test
    void deliversToSubscribersUntilTheyLeave() {
        SafeGoEventBus bus = new SafeGoEventBus();
        List<String> seen = new ArrayList<>();
        Runnable leave = bus.subscribe(event -> seen.add(event.type()));
        assertEquals(1, bus.subscriberCount());
        bus.publish(SafeGoEventBus.WEATHER_ESCALATED, null, Map.of());
        leave.run();
        bus.publish(SafeGoEventBus.UNIVERSITY_ADVISORY, "ust-manila", Map.of());
        assertEquals(List.of(SafeGoEventBus.WEATHER_ESCALATED), seen);
        assertEquals(0, bus.subscriberCount());
    }

    @Test
    void aBrokenSubscriberDoesNotStopTheOthers() {
        SafeGoEventBus bus = new SafeGoEventBus();
        List<Long> seen = new ArrayList<>();
        bus.subscribe(event -> { throw new IllegalStateException("closed stream"); });
        bus.subscribe(event -> seen.add(event.id()));
        bus.publish(SafeGoEventBus.WEATHER_ESCALATED, null, Map.of());
        assertEquals(1, seen.size());
    }

    @Test
    void replaysRecentEventsAfterAnId() {
        SafeGoEventBus bus = new SafeGoEventBus();
        for (int i = 0; i < 60; i++) bus.publish(SafeGoEventBus.WEATHER_ESCALATED, null, Map.of());
        assertEquals(SafeGoEventBus.RECENT, bus.since(0).size(), "only the most recent are kept");
        assertEquals(List.of(59L, 60L), bus.since(58).stream().map(SafeGoEventBus.Event::id).toList());
    }

    @Test
    void universityFilterKeepsEveryoneEventsAndThatCampusOnly() {
        var weather = new SafeGoEventBus.Event(1, SafeGoEventBus.WEATHER_ESCALATED, null, "now", Map.of());
        var ust = new SafeGoEventBus.Event(2, SafeGoEventBus.UNIVERSITY_ADVISORY, "ust-manila", "now", Map.of());
        assertTrue(SafeGoEventBus.matches(weather, "feu-manila"));
        assertTrue(SafeGoEventBus.matches(ust, "ust-manila"));
        assertFalse(SafeGoEventBus.matches(ust, "feu-manila"));
        assertTrue(SafeGoEventBus.matches(ust, null));
    }
}
