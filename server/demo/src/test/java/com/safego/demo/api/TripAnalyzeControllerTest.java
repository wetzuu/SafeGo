package com.safego.demo.api;

import com.safego.demo.data.DashboardService;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class TripAnalyzeControllerTest {

    private final DashboardService dashboard = new DashboardService();
    private final TripAnalyzeController controller = new TripAnalyzeController(dashboard);

    @Test
    void rejectsNullOrEmptyRequestBody() {
        ResponseEntity<Object> response = controller.analyze(null);
        assertEquals(400, response.getStatusCode().value());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        @SuppressWarnings("unchecked")
        Map<String, Object> error = (Map<String, Object>) body.get("error");
        assertEquals("INVALID_JSON", error.get("code"));
    }

    @Test
    void validatesEndpointsBeforeCallingTripServices() {
        ResponseEntity<Object> blank = controller.analyze(Map.of("origin", " ", "destination", "Pasig"));
        assertEquals(400, blank.getStatusCode().value());

        ResponseEntity<Object> tooLong = controller.analyze(Map.of("origin", "a".repeat(161), "destination", "Pasig"));
        assertEquals(400, tooLong.getStatusCode().value());

        ResponseEntity<Object> same = controller.analyze(Map.of("origin", " Pasig ", "destination", "PASIG"));
        assertEquals(400, same.getStatusCode().value());
        @SuppressWarnings("unchecked")
        Map<String, Object> sameBody = (Map<String, Object>) same.getBody();
        assertNotNull(sameBody);
        @SuppressWarnings("unchecked")
        Map<String, Object> sameError = (Map<String, Object>) sameBody.get("error");
        assertEquals("SAME_LOCATION", sameError.get("code"));
    }

    @Test
    void normalizesStringInputs() {
        assertEquals("espana", TripAnalyzeController.clean("  espana  "));
        assertEquals("espana", TripAnalyzeController.normalize("  España  "));
        assertEquals("lerma st", TripAnalyzeController.normalize("Lerma St."));
    }

}
