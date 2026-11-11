package com.safego.demo.events;

import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Consumer;

/**
 * In-process event bus. Producers (the weather monitor, the university scanner) publish; the SSE stream
 * subscribes. Keeps the last {@value #RECENT} events so a client that reconnects with Last-Event-ID
 * misses nothing. Events are not stored beyond that and do not survive a restart.
 */
@Service
public class SafeGoEventBus {

    public static final String WEATHER_ESCALATED = "WEATHER_ESCALATED";
    public static final String UNIVERSITY_ADVISORY = "UNIVERSITY_ADVISORY";
    static final int RECENT = 50;

    /** universityId is null for events that concern everyone, such as weather. */
    public record Event(long id, String type, String universityId, String at, Object data) {}

    private final List<Consumer<Event>> subscribers = new CopyOnWriteArrayList<>();
    private final Deque<Event> recent = new ArrayDeque<>();
    private long nextId = 1;

    public Event publish(String type, String universityId, Object data) {
        Event event;
        synchronized (this) {
            event = new Event(nextId++, type, universityId, Instant.now().toString(), data);
            recent.addLast(event);
            while (recent.size() > RECENT) recent.removeFirst();
        }
        for (Consumer<Event> subscriber : subscribers) {
            try {
                subscriber.accept(event);
            } catch (RuntimeException ignored) {
                // One broken subscriber (a closed stream) must not stop the others.
            }
        }
        return event;
    }

    /** Subscribes; the returned action unsubscribes. */
    public Runnable subscribe(Consumer<Event> subscriber) {
        subscribers.add(subscriber);
        return () -> subscribers.remove(subscriber);
    }

    /** Recent events after the given id, oldest first. */
    public synchronized List<Event> since(long lastId) {
        return recent.stream().filter(event -> event.id() > lastId).toList();
    }

    public int subscriberCount() {
        return subscribers.size();
    }

    /** Whether an event belongs on a stream filtered to one university (null: no filter). */
    public static boolean matches(Event event, String universityId) {
        return universityId == null || universityId.isBlank() || event.universityId() == null
            || event.universityId().equals(universityId);
    }
}
