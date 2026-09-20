package com.safego.demo.model;

public record UniversityStatus(
    String id,
    String name,
    String campus,
    String logoPath,
    String logoAlt,
    String status,
    String statusLabel,
    String announcement,
    String date,
    String time,
    boolean isMock,
    String sourceName,
    String announcementUrl,
    Boolean announcementVerified
) {}
