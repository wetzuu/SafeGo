package com.safego.demo.model;

public record Advisory(
    String source,
    String label,
    String title,
    String description,
    String time,
    String date,
    Boolean isMock
) {}
