package com.safego.demo.data;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class PagasaCapServiceTest {

    // A square around central Metro Manila, as CAP "latitude,longitude" pairs.
    private static final String METRO_MANILA_POLYGON =
        "14.50,120.95 14.50,121.10 14.70,121.10 14.70,120.95 14.50,120.95";

    private static String cap(String id, String references, String msgType, String severity, String urgency,
                              String responseType, String expires, String polygon) {
        return """
            <?xml version="1.0"?>
            <alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
              <identifier>%s</identifier><sender>PAGASA-DOST</sender><sent>2026-09-30T05:00:00+08:00</sent>
              <status>Actual</status><msgType>%s</msgType><scope>Public</scope>%s
              <info>
                <category>Met</category><event>General Flood Advisory</event><responseType>%s</responseType>
                <urgency>%s</urgency><severity>%s</severity><certainty>Likely</certainty>
                <expires>%s</expires><headline>General Flood Advisory - NCR</headline>
                <description>Rivers and tributaries in Metro Manila may be affected.</description>
                <area><areaDesc>Metro Manila</areaDesc><polygon>%s</polygon></area>
              </info>
            </alert>
            """.formatted(id, msgType, references.isEmpty() ? "" : "<references>" + references + "</references>",
            responseType, urgency, severity, expires, polygon);
    }

    private static final Instant NOW = Instant.parse("2026-09-30T00:00:00Z");
    private static final String LATER = "2026-09-30T20:00:00+08:00";
    private static final String EARLIER = "2026-09-29T20:00:00+08:00";

    @Test
    void parsesCapFieldsAndPolygons() throws Exception {
        var alert = PagasaCapService.parseCap(
            cap("a1", "", "Alert", "Moderate", "Expected", "Monitor", LATER, METRO_MANILA_POLYGON), "https://publicalert.pagasa.dost.gov.ph/output/gfa/a1.cap");
        assertEquals("a1", alert.id());
        assertEquals("General Flood Advisory - NCR", alert.headline());
        assertEquals("Moderate", alert.severity());
        assertEquals(Instant.parse("2026-09-30T12:00:00Z"), alert.expires());
        assertEquals(1, alert.areas().size());
        assertEquals(5, alert.areas().get(0).polygons().get(0).size());
        assertEquals(45, PagasaCapService.severityScore(alert));
    }

    @Test
    void coversUsesLatitudeLongitudeOrder() throws Exception {
        var alert = PagasaCapService.parseCap(
            cap("a1", "", "Alert", "Severe", "Expected", "Prepare", LATER, METRO_MANILA_POLYGON), "https://x/a1.cap");
        assertTrue(PagasaCapService.covers(alert, 14.6093, 120.9922), "Sampaloc is inside");
        assertFalse(PagasaCapService.covers(alert, 10.31, 123.89), "Cebu is outside");
    }

    @Test
    void activeDropsExpiredCancelledAllClearAndSupersededAlerts() throws Exception {
        var live = PagasaCapService.parseCap(cap("live", "", "Alert", "Severe", "Expected", "Prepare", LATER, METRO_MANILA_POLYGON), "https://x/1.cap");
        var expired = PagasaCapService.parseCap(cap("expired", "", "Alert", "Severe", "Expected", "Prepare", EARLIER, METRO_MANILA_POLYGON), "https://x/2.cap");
        var cancelled = PagasaCapService.parseCap(cap("cancelled", "", "Cancel", "Severe", "Expected", "Prepare", LATER, METRO_MANILA_POLYGON), "https://x/3.cap");
        var allClear = PagasaCapService.parseCap(cap("final", "", "Update", "Minor", "Past", "AllClear", LATER, METRO_MANILA_POLYGON), "https://x/4.cap");
        var old = PagasaCapService.parseCap(cap("old", "", "Alert", "Moderate", "Expected", "Prepare", LATER, METRO_MANILA_POLYGON), "https://x/5.cap");
        var update = PagasaCapService.parseCap(cap("new", "PAGASA-DOST,old,2026-09-30T04:00:00+08:00", "Update", "Severe", "Expected", "Prepare", LATER, METRO_MANILA_POLYGON), "https://x/6.cap");

        var active = PagasaCapService.active(List.of(live, expired, cancelled, allClear, old, update), NOW);
        assertEquals(List.of("live", "new"), active.stream().map(PagasaCapService.CapAlert::id).toList());
    }

    @Test
    void activeLooksBackInTimeUsingOnlyAlertsIssuedByThen() throws Exception {
        // Issued 05:00 Manila (21:00Z the day before); its replacement is issued 07:00 Manila (23:00Z).
        var old = PagasaCapService.parseCap(cap("old", "", "Alert", "Moderate", "Expected", "Prepare", LATER, METRO_MANILA_POLYGON), "https://x/o.cap");
        var replacement = PagasaCapService.parseCap(cap("new", "PAGASA-DOST,old,2026-09-30T05:00:00+08:00", "Update", "Severe", "Expected", "Prepare", LATER, METRO_MANILA_POLYGON)
            .replace("2026-09-30T05:00:00+08:00</sent>", "2026-09-30T07:00:00+08:00</sent>"), "https://x/n.cap");
        var alerts = List.of(old, replacement);
        assertEquals(List.of(), PagasaCapService.active(alerts, Instant.parse("2026-09-29T20:00:00Z")).stream().map(PagasaCapService.CapAlert::id).toList(), "before either was issued");
        assertEquals(List.of("old"), PagasaCapService.active(alerts, Instant.parse("2026-09-29T22:00:00Z")).stream().map(PagasaCapService.CapAlert::id).toList(), "only the first was issued");
        assertEquals(List.of("new"), PagasaCapService.active(alerts, Instant.parse("2026-09-30T00:00:00Z")).stream().map(PagasaCapService.CapAlert::id).toList(), "the replacement takes over");
    }

    @Test
    void severityMappingNeverScoresAnActiveAlertAsZero() throws Exception {
        for (var entry : List.of(new Object[] {"Extreme", 90}, new Object[] {"Severe", 70},
                new Object[] {"Moderate", 45}, new Object[] {"Minor", 25}, new Object[] {"Unknown", 25})) {
            var alert = PagasaCapService.parseCap(
                cap("s", "", "Alert", (String) entry[0], "Expected", "Prepare", LATER, METRO_MANILA_POLYGON), "https://x/s.cap");
            assertEquals(entry[1], PagasaCapService.severityScore(alert));
        }
    }

    @Test
    void rejectsDocumentsWithExternalEntities() {
        String xxe = """
            <?xml version="1.0"?>
            <!DOCTYPE alert [<!ENTITY secret SYSTEM "file:///etc/passwd">]>
            <alert xmlns="urn:oasis:names:tc:emergency:cap:1.2"><identifier>&secret;</identifier><info/></alert>
            """;
        assertThrows(Exception.class, () -> PagasaCapService.parseCap(xxe, "https://x/evil.cap"));
    }

    @Test
    void feedLinksOnlyIncludeCapDocuments() throws Exception {
        String atom = """
            <?xml version='1.0' encoding='UTF-8'?>
            <feed xmlns="http://www.w3.org/2005/Atom">
              <entry><id>1</id><link type="application/cap+xml" href="https://publicalert.pagasa.dost.gov.ph/output/gfa/1.cap"/></entry>
              <entry><id>2</id><link type="text/html" href="https://example.com/page"/></entry>
            </feed>
            """;
        assertEquals(List.of("https://publicalert.pagasa.dost.gov.ph/output/gfa/1.cap"), PagasaCapService.parseFeedLinks(atom));
    }

    @Test
    void disabledReaderReportsDisabledWithoutNetwork() {
        var result = PagasaCapService.disabled().activeAlerts();
        assertTrue(result.alerts().isEmpty());
        assertEquals("disabled", result.status().status());
    }

    @Test
    void dashboardAttachesAlertsOnlyToCoveredLocations() throws Exception {
        var alert = PagasaCapService.parseCap(
            cap("ncr", "", "Alert", "Severe", "Expected", "Prepare", LATER, METRO_MANILA_POLYGON), "https://x/ncr.cap");
        DashboardService dashboard = new DashboardService();
        List<JsonNode> items = dashboard.pagasaAdvisories(List.of(alert), dashboard.canonicalLocations());
        assertEquals(1, items.size());
        JsonNode item = items.get(0);
        assertEquals(70, item.path("severityScore").asInt());
        assertEquals("PAGASA", item.path("sourceName").asText());
        assertTrue(item.path("locationIds").size() > 0, "Metro Manila locations are covered");
    }
}
