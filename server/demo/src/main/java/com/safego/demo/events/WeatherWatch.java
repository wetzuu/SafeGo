package com.safego.demo.events;

import com.safego.demo.data.DashboardService;
import org.springframework.stereotype.Component;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Re-checks the weather every few minutes while someone is listening on the event stream, so a weather
 * escalation is noticed even when nobody refreshes the dashboard. Idle when nobody listens, so SafeGo
 * does not call Open-Meteo or PAGASA for an empty room.
 */
@Component
public class WeatherWatch {

    static final long INTERVAL_MINUTES = 5;

    public WeatherWatch(DashboardService dashboard, SafeGoEventBus bus) {
        ScheduledExecutorService timer = Executors.newSingleThreadScheduledExecutor(runnable -> {
            Thread thread = new Thread(runnable, "weather-watch");
            thread.setDaemon(true);
            return thread;
        });
        timer.scheduleWithFixedDelay(() -> {
            if (bus.subscriberCount() == 0) return;
            try {
                dashboard.snapshot(false);
            } catch (RuntimeException ignored) {
                // A failed check is retried on the next tick; sources report their own failures.
            }
        }, INTERVAL_MINUTES, INTERVAL_MINUTES, TimeUnit.MINUTES);
    }
}
