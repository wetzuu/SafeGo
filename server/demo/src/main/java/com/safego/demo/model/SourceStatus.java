package com.safego.demo.model;

public record SourceStatus(
    String key,
    String name,
    String kind,
    String status,
    String lastSuccessAt,
    String lastFailureAt,
    String errorMessage
) {}
