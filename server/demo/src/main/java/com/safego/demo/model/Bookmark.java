package com.safego.demo.model;

/** A place an account saved under its own name. */
public record Bookmark(
    String id,
    String name,
    SavedPlace place
) {}
