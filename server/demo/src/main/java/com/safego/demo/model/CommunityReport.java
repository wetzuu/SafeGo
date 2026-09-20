package com.safego.demo.model;

public record CommunityReport(
    String type,
    String title,
    String meta,
    String status,
    String statusLabel
) {}
