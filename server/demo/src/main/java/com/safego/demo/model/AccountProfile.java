package com.safego.demo.model;

public record AccountProfile(
    String email,
    String name,
    String home,
    String school,
    SavedPlace homePlace,
    SavedPlace schoolPlace,
    String persistence
) {}
