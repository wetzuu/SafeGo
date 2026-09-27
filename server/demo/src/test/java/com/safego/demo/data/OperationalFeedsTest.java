package com.safego.demo.data;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.safego.demo.model.SafeGoLocation;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class OperationalFeedsTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Test
    void normalizesAnApprovedOfficialAdvisoryPayload() throws Exception {
        String futureExpiry = Instant.now().plusSeconds(7200).toString();
        String json = """
            {
              "items": [
                {
                  "id": "pagasa-123",
                  "locationIds": ["espana"],
                  "sourceName": "PAGASA",
                  "sourceKind": "weather",
                  "title": "Heavy rainfall advisory",
                  "description": "Heavy rainfall may affect Metro Manila.",
                  "severityScore": 70,
                  "issuedAt": "2026-09-07T08:00:00Z",
                  "expiresAt": "%s",
                  "sourceUrl": "https://www.pagasa.dost.gov.ph/advisory/123"
                }
              ]
            }
            """.formatted(futureExpiry);

        JsonNode root = MAPPER.readTree(json);
        List<JsonNode> items = DashboardService.parseFeedItems(root, true);

        assertEquals(1, items.size());
        assertEquals(70, items.get(0).path("severityScore").asInt());
        assertEquals("espana", items.get(0).path("locationIds").get(0).asText());
    }

    @Test
    void rejectsUnofficialAdvisorySourceKinds() throws Exception {
        String futureExpiry = Instant.now().plusSeconds(7200).toString();
        String json = """
            {
              "items": [
                {
                  "id": "social-123",
                  "locationIds": ["espana"],
                  "sourceName": "Unknown poster",
                  "sourceKind": "community",
                  "title": "Claimed advisory",
                  "description": "This must not enter the official advisory factor.",
                  "severityScore": 90,
                  "issuedAt": "2026-09-07T08:00:00Z",
                  "expiresAt": "%s",
                  "sourceUrl": "https://example.com/post/123"
                }
              ]
            }
            """.formatted(futureExpiry);

        JsonNode root = MAPPER.readTree(json);
        IllegalArgumentException thrown = assertThrows(IllegalArgumentException.class, () ->
            DashboardService.parseFeedItems(root, true)
        );
        assertTrue(thrown.getMessage().toLowerCase().contains("advisory source kind"));
    }

    @Test
    void validatesFloodAndRoadSeverityBoundaries() throws Exception {
        String futureExpiry = Instant.now().plusSeconds(7200).toString();
        String json = """
            {
              "items": [
                {
                  "id": "road-123",
                  "locationIds": ["espana"],
                  "sourceName": "Official road office",
                  "kind": "road",
                  "title": "Road closure",
                  "description": "The road is temporarily closed.",
                  "severityScore": 101,
                  "observedAt": "2026-09-07T08:00:00Z",
                  "expiresAt": "%s",
                  "sourceUrl": "https://official.example/road/123"
                }
              ]
            }
            """.formatted(futureExpiry);

        JsonNode root = MAPPER.readTree(json);
        IllegalArgumentException thrown = assertThrows(IllegalArgumentException.class, () ->
            DashboardService.parseFeedItems(root, false)
        );
        assertTrue(thrown.getMessage().toLowerCase().contains("severity score"));
    }

    @Test
    void rejectsNonHttpsSourceEvidenceLinks() throws Exception {
        String futureExpiry = Instant.now().plusSeconds(7200).toString();
        String json = """
            {
              "items": [
                {
                  "id": "flood-123",
                  "locationIds": ["espana"],
                  "sourceName": "Official disaster office",
                  "kind": "flood",
                  "title": "Road flooding",
                  "description": "Water is rising at the monitored point.",
                  "severityScore": 80,
                  "observedAt": "2026-09-07T08:00:00Z",
                  "expiresAt": "%s",
                  "sourceUrl": "http://unsafe.example/flood/123"
                }
              ]
            }
            """.formatted(futureExpiry);

        JsonNode root = MAPPER.readTree(json);
        IllegalArgumentException thrown = assertThrows(IllegalArgumentException.class, () ->
            DashboardService.parseFeedItems(root, false)
        );
        assertTrue(thrown.getMessage().contains("HTTPS"));
    }

    @Test
    void officialFeedReplacesOnlyTheAdvisoryFactorAndKeepsProvenance() throws Exception {
        DashboardService service = new DashboardService();
        List<SafeGoLocation> locations = MockRepository.listDashboardLocations();

        String futureExpiry = Instant.now().plusSeconds(7200).toString();
        String json = """
            {
              "items": [
                {
                  "id": "pagasa-456",
                  "locationIds": ["espana"],
                  "sourceName": "PAGASA",
                  "sourceKind": "weather",
                  "title": "Heavy rainfall advisory",
                  "description": "Heavy rainfall may affect Metro Manila.",
                  "severityScore": 80,
                  "issuedAt": "2026-09-07T08:00:00Z",
                  "expiresAt": "%s",
                  "sourceUrl": "https://www.pagasa.dost.gov.ph/advisory/456"
                }
              ]
            }
            """.formatted(futureExpiry);

        List<JsonNode> items = DashboardService.parseFeedItems(MAPPER.readTree(json), true);
        List<SafeGoLocation> updatedLocations = service.applyFeed(locations, items, true);

        SafeGoLocation updatedEspana = updatedLocations.stream()
            .filter(l -> "espana".equals(l.id()))
            .findFirst()
            .orElseThrow();

        int advisoryScore = updatedEspana.factors().stream()
            .filter(f -> "Official advisories".equals(f.name()))
            .findFirst().orElseThrow().score();
        int floodScore = updatedEspana.factors().stream()
            .filter(f -> "Flood / roads".equals(f.name()))
            .findFirst().orElseThrow().score();

        assertEquals(80, advisoryScore);
        assertEquals(52, floodScore);
        assertEquals("https://www.pagasa.dost.gov.ph/advisory/456", updatedEspana.advisories().get(0).sourceUrl());
    }

    @Test
    void severeFloodObservationsTriggerTheExistingCriticalSafetyFloor() throws Exception {
        DashboardService service = new DashboardService();
        List<SafeGoLocation> locations = MockRepository.listDashboardLocations();

        String futureExpiry = Instant.now().plusSeconds(7200).toString();
        String json = """
            {
              "items": [
                {
                  "id": "flood-456",
                  "locationIds": ["mapua-makati"],
                  "sourceName": "Official disaster office",
                  "kind": "flood",
                  "title": "Deep flooding",
                  "description": "The monitored access road is not passable.",
                  "severityScore": 90,
                  "observedAt": "2026-09-07T08:00:00Z",
                  "expiresAt": "%s",
                  "sourceUrl": "https://official.example/flood/456"
                }
              ]
            }
            """.formatted(futureExpiry);

        List<JsonNode> items = DashboardService.parseFeedItems(MAPPER.readTree(json), false);
        List<SafeGoLocation> updatedLocations = service.applyFeed(locations, items, false);

        SafeGoLocation updatedMakati = updatedLocations.stream()
            .filter(l -> "mapua-makati".equals(l.id()))
            .findFirst()
            .orElseThrow();

        int floodScore = updatedMakati.factors().stream()
            .filter(f -> "Flood / roads".equals(f.name()))
            .findFirst().orElseThrow().score();

        assertEquals(90, floodScore);
        assertEquals(80, updatedMakati.risk().percentage());
        assertEquals("crit", updatedMakati.risk().key());
    }
}
