package com.safego.demo.model;

/** A community report as moderators see it: who-agnostic, with its review state. */
public record ReportEntry(
    String id,
    String locationId,
    String locationName,
    String type,
    String description,
    String locationText,
    /** "unverified", "verified" or "rejected". Rejected reports are hidden from the public. */
    String status,
    String submittedAt,
    String reviewedAt,
    String reviewedBy
) {}
