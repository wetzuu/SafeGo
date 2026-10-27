package com.safego.demo.data;

import com.safego.demo.model.*;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * The in-process store used without a database: the places SafeGo rates and the community reports
 * submitted while this server is running. It holds no seeded conditions or reports.
 */
public final class LocalRepository {

    private static final int MAX_SESSION_REPORTS = 500;
    private static final ZoneId MANILA = ZoneId.of("Asia/Manila");
    /** Reports submitted while this server has been running, newest first. */
    private static final List<ReportEntry> submittedReports = new ArrayList<>();
    private static final List<SafeGoLocation> LOCATIONS = LocationAnchors.locations();

    private LocalRepository() {}

    public static List<SafeGoLocation> listDashboardLocations() {
        return LOCATIONS.stream()
            .map(LocalRepository::withSubmittedReports)
            .toList();
    }

    public static Optional<CommunityReport> submitCommunityReport(
            String locationId, String reportType, String locationText, String description) {

        boolean exists = LOCATIONS.stream().anyMatch(loc -> loc.id().equals(locationId));
        if (!exists) return Optional.empty();

        String locationName = LOCATIONS.stream().filter(loc -> loc.id().equals(locationId)).findFirst().map(SafeGoLocation::name).orElse(locationId);
        ReportEntry entry = new ReportEntry(UUID.randomUUID().toString(), locationId, locationName, reportType, description,
            locationText, "unverified", Instant.now().toString(), null, null);
        synchronized (submittedReports) {
            submittedReports.add(0, entry);
            while (submittedReports.size() > MAX_SESSION_REPORTS) submittedReports.remove(submittedReports.size() - 1);
        }
        return Optional.of(toPublic(entry));
    }

    /** Every submitted report, newest first, for moderators. */
    public static List<ReportEntry> listReportEntries() {
        synchronized (submittedReports) {
            return List.copyOf(submittedReports);
        }
    }

    /** Sets a report's review state; empty when the report does not exist. */
    public static Optional<ReportEntry> reviewReport(String id, String status, String reviewer) {
        synchronized (submittedReports) {
            for (int i = 0; i < submittedReports.size(); i++) {
                ReportEntry entry = submittedReports.get(i);
                if (!entry.id().equals(id)) continue;
                boolean reviewed = !"unverified".equals(status);
                ReportEntry updated = new ReportEntry(entry.id(), entry.locationId(), entry.locationName(), entry.type(), entry.description(),
                    entry.locationText(), status, entry.submittedAt(), reviewed ? Instant.now().toString() : null, reviewed ? reviewer : null);
                submittedReports.set(i, updated);
                return Optional.of(updated);
            }
        }
        return Optional.empty();
    }

    /** What the public sees for a location: submitted reports that have not been rejected, newest first. */
    public static List<CommunityReport> publicReports(String locationId) {
        synchronized (submittedReports) {
            return submittedReports.stream()
                .filter(entry -> entry.locationId().equals(locationId) && !"rejected".equals(entry.status()))
                .map(LocalRepository::toPublic)
                .toList();
        }
    }

    static CommunityReport toPublic(ReportEntry entry) {
        ZonedDateTime at = Instant.parse(entry.submittedAt()).atZone(MANILA);
        boolean verified = "verified".equals(entry.status());
        return new CommunityReport(entry.type(), entry.description(),
            entry.locationText() + " · " + DateTimeFormatter.ofPattern("MMM d, h:mm a", Locale.ENGLISH).format(at),
            verified ? "verified" : "unverified", verified ? "Verified" : "Unverified");
    }

    private static List<CommunityReport> reportsFor(SafeGoLocation loc) {
        List<CommunityReport> result = new ArrayList<>(publicReports(loc.id()));
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
}
