package com.safego.demo.data;

import com.safego.demo.model.*;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

class MockRepositoryTest {

    private static final List<String> AREA_DASHBOARD_IDS = List.of(
        "espana", "lerma", "quiapo", "mapua-makati", "ortigas-pasig"
    );

    @Test
    void mockRepositoryExposesEveryPresetLocation() {
        List<LocationSummary> locations = MockRepository.listLocations();

        assertEquals(7, locations.size());
        assertTrue(locations.stream().allMatch(l -> l.coordinates().length == 2));
        assertTrue(locations.stream().allMatch(l -> l.risk().percentage() >= 0));
    }

    @Test
    void mockRepositoryReturnsCalculatedRiskDetails() {
        Optional<LocationRiskDetails> result = MockRepository.getLocationRisk("espana");

        assertTrue(result.isPresent());
        LocationRiskDetails details = result.get();
        assertEquals("espana", details.location().id());
        assertEquals(5, details.factors().size());
        assertEquals("1.0.0", details.assessment().modelVersion());
        assertEquals(54, details.assessment().percentage());
        assertTrue(details.advisories().stream().allMatch(a -> a.isMock() && "Sep 14, 2026".equals(a.date())));
        assertTrue(details.advisories().stream().anyMatch(a -> "PAGASA".equals(a.label()) && a.isMock()));
    }

    @Test
    void pasigExposesAreaSpecificNearbyUniversityStatuses() {
        List<SafeGoLocation> locations = MockRepository.listDashboardLocations();
        SafeGoLocation pasig = locations.stream()
            .filter(l -> "ortigas-pasig".equals(l.id()))
            .findFirst()
            .orElse(null);

        assertNotNull(pasig);
        assertEquals("Pasig", pasig.city());
        assertEquals(2, pasig.universities().size());
        assertTrue(pasig.universities().stream().allMatch(UniversityStatus::isMock));
        assertTrue(pasig.universities().stream().anyMatch(u -> "suspended".equals(u.status())));
        assertTrue(pasig.universities().stream().allMatch(u ->
            u.campus() != null && (u.campus().toLowerCase().contains("pasig") || u.campus().toLowerCase().contains("ortigas"))
        ));
    }

    @Test
    void everySupportedDashboardAreaHasUniversityStatusesAndOnlyVerifiedPostsAreLinked() {
        List<SafeGoLocation> areas = MockRepository.listDashboardLocations().stream()
            .filter(l -> AREA_DASHBOARD_IDS.contains(l.id()))
            .toList();

        assertEquals(5, areas.size());
        assertTrue(areas.stream().allMatch(a -> !a.universities().isEmpty()));

        List<UniversityStatus> universities = areas.stream()
            .flatMap(a -> a.universities().stream())
            .toList();

        assertTrue(universities.stream().allMatch(u ->
            u.logoPath() != null && u.logoPath().startsWith("/university-logos/")
                && u.logoAlt() != null && !u.logoAlt().isEmpty()
        ));

        List<UniversityStatus> linked = universities.stream()
            .filter(u -> u.announcementUrl() != null && !u.announcementUrl().isEmpty())
            .toList();

        assertEquals(1, linked.size());
        assertTrue(linked.stream().allMatch(u ->
            u.announcementVerified()
                && !u.isMock()
                && u.announcementUrl().startsWith("https://www.facebook.com/")
        ));
    }

    @Test
    void mockRepositoryReturnsNullForAnUnknownLocation() {
        assertTrue(MockRepository.getLocationRisk("not-a-location").isEmpty());
    }

    @Test
    void mockRepositoryStoresNewReportsAsUnverified() {
        Optional<CommunityReport> report = MockRepository.submitCommunityReport(
            "mapua-makati",
            "Road Hazard",
            "Mapúa Makati gate",
            "A fallen branch is blocking one lane."
        );

        assertTrue(report.isPresent());
        assertEquals("unverified", report.get().status());

        SafeGoLocation location = MockRepository.listDashboardLocations().stream()
            .filter(l -> "mapua-makati".equals(l.id()))
            .findFirst()
            .orElse(null);

        assertNotNull(location);
        assertFalse(location.reports().isEmpty());
        assertEquals("A fallen branch is blocking one lane.", location.reports().get(0).title());
    }
}
