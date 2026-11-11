package com.safego.demo.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.safego.demo.events.SafeGoEventBus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;

/**
 * Server-Sent Events: WEATHER_ESCALATED and UNIVERSITY_ADVISORY as they happen. Optional
 * ?universityId= limits advisories to one campus (weather events always come through). A client
 * reconnecting with Last-Event-ID receives the recent events it missed.
 */
@RestController
@RequestMapping("/api/events")
public class EventsController {

    static final long TIMEOUT_MS = 30 * 60_000L;
    static final long HEARTBEAT_SECONDS = 25;

    private final SafeGoEventBus bus;
    private final ObjectMapper mapper = new ObjectMapper();
    private final ScheduledExecutorService heartbeat = Executors.newSingleThreadScheduledExecutor(runnable -> {
        Thread thread = new Thread(runnable, "sse-heartbeat");
        thread.setDaemon(true);
        return thread;
    });

    public EventsController(SafeGoEventBus bus) {
        this.bus = bus;
    }

    @GetMapping
    public ResponseEntity<SseEmitter> stream(
            @RequestParam(value = "universityId", required = false) String universityId,
            @RequestHeader(value = "Last-Event-ID", required = false) String lastEventId) {
        SseEmitter emitter = new SseEmitter(TIMEOUT_MS);
        Consumer<SafeGoEventBus.Event> send = event -> {
            if (!SafeGoEventBus.matches(event, universityId)) return;
            try {
                String json = mapper.writeValueAsString(event.data());
                synchronized (emitter) {
                    emitter.send(SseEmitter.event().id(String.valueOf(event.id())).name(event.type()).data(json));
                }
            } catch (Exception e) {
                emitter.completeWithError(e);
            }
        };

        long since = parseId(lastEventId);
        if (since >= 0) bus.since(since).forEach(send);
        Runnable unsubscribe = bus.subscribe(send);
        // Comments keep proxies from closing an idle stream.
        ScheduledFuture<?> ping = heartbeat.scheduleAtFixedRate(() -> {
            try {
                synchronized (emitter) {
                    emitter.send(SseEmitter.event().comment("ping"));
                }
            } catch (Exception e) {
                emitter.complete();
            }
        }, HEARTBEAT_SECONDS, HEARTBEAT_SECONDS, TimeUnit.SECONDS);
        Runnable cleanup = () -> {
            unsubscribe.run();
            ping.cancel(false);
        };
        emitter.onCompletion(cleanup);
        emitter.onTimeout(cleanup);
        emitter.onError(error -> cleanup.run());

        return ResponseEntity.ok()
            // no-transform stops proxies and compression from buffering the stream.
            .header("Cache-Control", "no-cache, no-transform")
            .header("X-Accel-Buffering", "no")
            .contentType(MediaType.TEXT_EVENT_STREAM)
            .body(emitter);
    }

    static long parseId(String value) {
        if (value == null || value.isBlank()) return -1;
        try {
            return Long.parseLong(value.trim());
        } catch (NumberFormatException e) {
            return -1;
        }
    }
}
