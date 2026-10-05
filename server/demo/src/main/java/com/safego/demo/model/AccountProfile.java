package com.safego.demo.model;

import java.util.List;

public record AccountProfile(
    String email,
    String name,
    String home,
    String school,
    SavedPlace homePlace,
    SavedPlace schoolPlace,
    List<Bookmark> bookmarks,
    String persistence
) {}
