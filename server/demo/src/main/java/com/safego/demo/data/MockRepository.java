package com.safego.demo.data;

import com.safego.demo.model.*;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

public final class MockRepository {

    private static final int MAX_SESSION_REPORTS_PER_LOCATION = 100;
    private static final Map<String, List<CommunityReport>> submittedReports = new LinkedHashMap<>();
    private static final List<SafeGoLocation> LOCATIONS = MockLocationsSeed.loadLocations();

    private MockRepository() {}

    public static List<LocationSummary> listLocations() {
        return LOCATIONS.stream().map(MockRepository::summarize).toList();
    }

    public static List<SafeGoLocation> listDashboardLocations() {
        return LOCATIONS.stream()
            .map(MockRepository::withSubmittedReports)
            .toList();
    }

    public static Optional<LocationRiskDetails> getLocationRisk(String id) {
        return LOCATIONS.stream()
            .filter(loc -> loc.id().equals(id))
            .findFirst()
            .map(loc -> new LocationRiskDetails(
                summarize(loc),
                loc.risk(),
                loc.factors(),
                loc.advisories(),
                reportsFor(loc)
            ));
    }

    public static List<SourceStatus> listSourceStatuses() {
        return List.of(new SourceStatus(
            "prototype-mock",
            "SafeGo prototype dataset",
            "mock",
            "mock",
            null, null, null
        ));
    }

    public static Optional<CommunityReport> submitCommunityReport(
            String locationId, String reportType, String locationText, String description) {

        boolean exists = LOCATIONS.stream().anyMatch(loc -> loc.id().equals(locationId));
        if (!exists) return Optional.empty();

        ZonedDateTime now = ZonedDateTime.now(ZoneId.of("Asia/Manila"));
        String time = DateTimeFormatter.ofPattern("h:mm a").format(now);
        CommunityReport report = new CommunityReport(
            reportType,
            description,
            locationText + " · " + time,
            "unverified",
            "UNVERIFIED"
        );

        submittedReports.compute(locationId, (key, existing) -> {
            List<CommunityReport> updated = new ArrayList<>();
            updated.add(report);
            if (existing != null) updated.addAll(existing);
            return updated.stream().limit(MAX_SESSION_REPORTS_PER_LOCATION).toList();
        });

        return Optional.of(report);
    }

    private static List<CommunityReport> reportsFor(SafeGoLocation loc) {
        List<CommunityReport> result = new ArrayList<>();
        List<CommunityReport> submitted = submittedReports.get(loc.id());
        if (submitted != null) result.addAll(submitted);
        result.addAll(loc.reports());
        return Collections.unmodifiableList(result);
    }

    private static SafeGoLocation withSubmittedReports(SafeGoLocation loc) {
        List<CommunityReport> merged = reportsFor(loc);
        if (merged.size() == loc.reports().size()) return loc;
        return new SafeGoLocation(
            loc.id(), loc.name(), loc.city(), loc.aliases(), loc.coordinates(),
            loc.updated(), loc.riskSummary(), loc.riskStatus(),
            loc.stats(), loc.factors(), loc.advisories(), loc.universities(),
            merged, loc.points(), loc.floods(), loc.hazards(), loc.risk()
        );
    }

    private static LocationSummary summarize(SafeGoLocation loc) {
        RiskAssessment r = loc.risk();
        return new LocationSummary(
            loc.id(), loc.name(), loc.city(), loc.aliases(), loc.coordinates(), loc.updated(),
            new LocationSummary.RiskSummary(r.key(), r.name(), r.rank(), r.percentage(), r.modelVersion())
        );
    }
}
