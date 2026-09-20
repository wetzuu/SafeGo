package com.safego.demo.model;

import java.util.List;

public record DashboardSnapshot(
    List<SafeGoLocation> locations,
    List<SourceStatus> sources,
    String weatherUpdatedAt
) {}
