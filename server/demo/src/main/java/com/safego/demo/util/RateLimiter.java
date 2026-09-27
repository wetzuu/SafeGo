package com.safego.demo.util;

import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

public class RateLimiter {

    private final ConcurrentHashMap<String, List<Long>> timestamps = new ConcurrentHashMap<>();

    public boolean tryAcquire(String key, long windowMs, int maxPerWindow) {
        long now = System.currentTimeMillis();
        List<Long> times = timestamps.computeIfAbsent(key, k -> new CopyOnWriteArrayList<>());
        List<Long> recent = times.stream().filter(t -> now - t < windowMs).toList();
        if (recent.size() >= maxPerWindow) {
            timestamps.put(key, new CopyOnWriteArrayList<>(recent));
            return false;
        }
        List<Long> updated = new CopyOnWriteArrayList<>(recent);
        updated.add(now);
        timestamps.put(key, updated);
        return true;
    }

    public void clear() {
        timestamps.clear();
    }
}
