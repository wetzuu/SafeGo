package com.safego.demo.api;

import com.safego.demo.data.DashboardService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class ReportsControllerTest {

    private final DashboardService dashboard = new DashboardService();
    private final ReportsController controller = new ReportsController(dashboard);

    @BeforeEach
    void setUp() {
        ReportsController.reportingEnabledOverride = null;
        ReportsController.clearSubmissions();
    }

    @AfterEach
    void tearDown() {
        ReportsController.reportingEnabledOverride = null;
        ReportsController.clearSubmissions();
    }

    @Test
    void rejectsSubmissionsWhenDisabledByDefault() {
        ReportsController.reportingEnabledOverride = false;

        ResponseEntity<Object> response = controller.submit(Map.of(
            "locationId", "espana",
            "reportType", "Flooding",
            "locationText", "España Blvd.",
            "description", "Water is rising near the corner."
        ), null, null);

        assertEquals(503, response.getStatusCode().value());
    }

    @Test
    void acceptsAndNormalizesAValidCommunityReport() {
        ReportsController.reportingEnabledOverride = true;

        ResponseEntity<Object> response = controller.submit(Map.of(
            "locationId", "mapua-makati",
            "reportType", "Flooding",
            "locationText", "  Mapúa   Makati gate  ",
            "description", "  Water is rising near the main gate.  "
        ), null, "127.0.0.1");

        assertEquals(201, response.getStatusCode().value());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        Object dataObj = body.get("data");
        assertTrue(dataObj instanceof com.safego.demo.model.CommunityReport);
        com.safego.demo.model.CommunityReport report = (com.safego.demo.model.CommunityReport) dataObj;
        assertEquals("Flooding", report.type());
        assertEquals("Water is rising near the main gate.", report.title());
        assertTrue(report.meta().startsWith("Mapúa Makati gate"));
        assertEquals("unverified", report.status());
    }

    @Test
    void rejectsInvalidReportTypes() {
        ReportsController.reportingEnabledOverride = true;

        ResponseEntity<Object> response = controller.submit(Map.of(
            "locationId", "mapua-makati",
            "reportType", "Definitely Safe",
            "locationText", "Mapúa Makati gate",
            "description", "Everything looks fine from here."
        ), null, null);

        assertEquals(400, response.getStatusCode().value());
    }

    @Test
    void rejectsDescriptionsThatCannotHelpOtherTravelers() {
        ReportsController.reportingEnabledOverride = true;

        ResponseEntity<Object> response = controller.submit(Map.of(
            "locationId", "mapua-makati",
            "reportType", "Other",
            "locationText", "Mapúa Makati gate",
            "description", "bad"
        ), null, null);

        assertEquals(400, response.getStatusCode().value());
    }

    @Test
    void rejectsUnknownLocationIds() {
        ReportsController.reportingEnabledOverride = true;

        ResponseEntity<Object> response = controller.submit(Map.of(
            "locationId", "unknown-place-id",
            "reportType", "Flooding",
            "locationText", "Some street",
            "description", "Ankle deep water on road."
        ), null, null);

        assertEquals(404, response.getStatusCode().value());
    }

    @Test
    void appliesRateLimitingAfterMaxSubmissions() {
        ReportsController.reportingEnabledOverride = true;
        String clientIp = "192.168.1.100";

        for (int i = 0; i < 5; i++) {
            ResponseEntity<Object> ok = controller.submit(Map.of(
                "locationId", "espana",
                "reportType", "Flooding",
                "locationText", "España Blvd.",
                "description", "Ankle deep water on road " + i + "."
            ), null, clientIp);
            assertEquals(201, ok.getStatusCode().value());
        }

        ResponseEntity<Object> limited = controller.submit(Map.of(
            "locationId", "espana",
            "reportType", "Flooding",
            "locationText", "España Blvd.",
            "description", "Ankle deep water on road 6."
        ), null, clientIp);

        assertEquals(429, limited.getStatusCode().value());
    }
}
