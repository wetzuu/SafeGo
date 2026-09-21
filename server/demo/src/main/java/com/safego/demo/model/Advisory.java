package com.safego.demo.model;

public record Advisory(
    String source,
    String label,
    String title,
    String description,
    String time,
    String date,
    Boolean isMock,
    String sourceUrl
) {
    public Advisory(String source, String label, String title, String description, String time, String date, Boolean isMock) {
        this(source, label, title, description, time, date, isMock, null);
    }
}
