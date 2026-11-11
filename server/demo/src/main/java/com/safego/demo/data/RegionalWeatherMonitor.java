package com.safego.demo.data;

import com.safego.demo.model.RiskFactor;
import com.safego.demo.model.SafeGoLocation;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.function.Predicate;

/**
 * Watches the weather across the campus commuter zones and reports when it escalates, e.g. from clear
 * to light rain. Escalation starts a university suspension scan and an event on the stream.
 *
 * <p>States come from SafeGo's live weather score (Open-Meteo) and PAGASA alerts. There is no
 * "overcast" state: Open-Meteo's overcast code scores like partly cloudy, and overcast skies are the
 * norm for much of Manila's wet season, so it would start a scan almost every day.
 */
public final class RegionalWeatherMonitor {

    public enum State { CLEAR, LIGHT_RAIN, SEVERE }

    /** Weather scores at or above these count as light rain (drizzle, light rain, gusts) and severe. */
    public static final int LIGHT_RAIN_SCORE = 25;
    public static final int SEVERE_SCORE = 60;
    /** After an escalation fires, another cannot fire for this long, however the weather flickers. */
    public static final Duration DEBOUNCE = Duration.ofMinutes(30);

    public record Reading(State state, String reason) {}

    public record Transition(State from, State to, String reason, Instant at) {}

    private State current;
    private Instant lastFiredAt;

    /** The worst weather in the zones: the highest live weather score, and any PAGASA alert. */
    public static Reading classify(List<SafeGoLocation> locations, boolean pagasaAlert, Predicate<double[]> inZone) {
        int worst = -1;
        String where = null;
        for (SafeGoLocation location : locations) {
            if (!inZone.test(location.coordinates())) continue;
            for (RiskFactor factor : location.factors()) {
                if ("Weather".equals(factor.name()) && !"Unavailable".equals(factor.pillText()) && factor.score() > worst) {
                    worst = factor.score();
                    where = location.name();
                }
            }
        }
        if (worst >= SEVERE_SCORE) return new Reading(State.SEVERE, "Heavy rain or strong wind near " + where + ".");
        if (worst >= LIGHT_RAIN_SCORE) return new Reading(State.LIGHT_RAIN, "Rain or gusty wind near " + where + ".");
        if (pagasaAlert) return new Reading(State.LIGHT_RAIN, "A PAGASA alert is in force over a SafeGo location.");
        return new Reading(State.CLEAR, null);
    }

    /**
     * Records the latest reading. Returns a transition when the weather rose to a worse state (the first
     * reading after startup counts as rising from clear), unless one fired within {@link #DEBOUNCE}.
     */
    public synchronized Optional<Transition> observe(Reading reading, Instant now) {
        State previous = current == null ? State.CLEAR : current;
        current = reading.state();
        if (reading.state().compareTo(previous) <= 0) return Optional.empty();
        if (lastFiredAt != null && Duration.between(lastFiredAt, now).compareTo(DEBOUNCE) < 0) return Optional.empty();
        lastFiredAt = now;
        return Optional.of(new Transition(previous, reading.state(), reading.reason(), now));
    }

    public synchronized State current() {
        return current == null ? State.CLEAR : current;
    }
}
