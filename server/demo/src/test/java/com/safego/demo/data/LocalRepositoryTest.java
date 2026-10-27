package com.safego.demo.data;

import com.safego.demo.model.*;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

class LocalRepositoryTest {

    @Test
    void holdsEveryPlaceAsAnAnchorWithNoStoredConditions() {
        List<SafeGoLocation> locations = LocalRepository.listDashboardLocations();

        assertEquals(18, locations.size());
        assertEquals(locations.size(), locations.stream().map(SafeGoLocation::id).distinct().count(), "ids are unique");
        for (SafeGoLocation location : locations) {
            assertEquals(2, location.coordinates().length);
            assertTrue(location.factors().stream().allMatch(f -> f.score() == 0 && "Unavailable".equals(f.pillText())),
                location.id() + " stores no readings");
            assertTrue(location.advisories().isEmpty(), location.id() + " stores no advisories");
            assertTrue(location.universities().isEmpty(), location.id() + " stores no university statuses");
            assertTrue(location.points().isEmpty() && location.floods().isEmpty() && location.hazards().isEmpty(),
                location.id() + " stores no observations");
        }
    }

    @Test
    void storesNewReportsAsUnverifiedOnTheirLocation() {
        Optional<CommunityReport> report = LocalRepository.submitCommunityReport(
            "mapua-makati", "Road Hazard", "Mapúa Makati gate", "A fallen branch is blocking one lane.");

        assertTrue(report.isPresent());
        assertEquals("unverified", report.get().status());

        SafeGoLocation location = LocalRepository.listDashboardLocations().stream()
            .filter(l -> "mapua-makati".equals(l.id()))
            .findFirst()
            .orElseThrow();
        assertEquals("A fallen branch is blocking one lane.", location.reports().get(0).title());
    }

    @Test
    void refusesReportsForUnknownPlaces() {
        assertTrue(LocalRepository.submitCommunityReport("not-a-location", "Flooding", "Somewhere", "Water on the road.").isEmpty());
    }

    @Test
    void moderatorsCanVerifyRejectAndRestoreAReport() {
        LocalRepository.submitCommunityReport("espana", "Flooding", "España corner Lacson", "Knee-deep water at the corner, cars are turning back.");
        var entry = LocalRepository.listReportEntries().get(0);
        assertEquals("unverified", entry.status());
        assertEquals("España Blvd., Sampaloc", entry.locationName());

        var verified = LocalRepository.reviewReport(entry.id(), "verified", "mod@safego.test").orElseThrow();
        assertEquals("verified", verified.status());
        assertEquals("mod@safego.test", verified.reviewedBy());
        assertEquals("verified", LocalRepository.publicReports("espana").get(0).status());
        assertEquals("Verified", LocalRepository.publicReports("espana").get(0).statusLabel());

        LocalRepository.reviewReport(entry.id(), "rejected", "mod@safego.test");
        assertTrue(LocalRepository.publicReports("espana").stream().noneMatch(report -> report.title().startsWith("Knee-deep water")));
        assertEquals("rejected", LocalRepository.listReportEntries().stream().filter(e -> e.id().equals(entry.id())).findFirst().orElseThrow().status());

        var restored = LocalRepository.reviewReport(entry.id(), "unverified", "mod@safego.test").orElseThrow();
        assertNull(restored.reviewedBy());
        assertTrue(LocalRepository.publicReports("espana").stream().anyMatch(report -> report.title().startsWith("Knee-deep water")));
        assertTrue(LocalRepository.reviewReport("missing", "verified", "mod@safego.test").isEmpty());
    }
}
