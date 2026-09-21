package com.safego.demo.model;

public record Hazard(
    String title,
    String meta,
    String tone,
    String sourceUrl
) {
    public Hazard(String title, String meta, String tone) {
        this(title, meta, tone, null);
    }
}
