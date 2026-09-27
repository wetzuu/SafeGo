package com.safego.demo.api;

import com.safego.demo.data.DashboardService;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class LocationsControllersTest {

    private final DashboardService dashboard = new DashboardService();
    private final LocationsController locationsController = new LocationsController(dashboard);
    private final LocationRiskController riskController = new LocationRiskController(dashboard);
    private final SourcesStatusController sourcesController = new SourcesStatusController(dashboard);
    private final DashboardController dashboardController = new DashboardController(dashboard);

    @Test
    void locationsControllerListsAllLocations() {
        ResponseEntity<Object> response = locationsController.list();
        assertEquals(200, response.getStatusCode().value());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        @SuppressWarnings("unchecked")
        List<?> data = (List<?>) body.get("data");
        assertEquals(7, data.size());
    }

    @Test
    void locationRiskControllerReturnsDetailForKnownLocation() {
        ResponseEntity<Object> response = riskController.risk("espana");
        assertEquals(200, response.getStatusCode().value());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertNotNull(body.get("data"));
    }

    @Test
    void locationRiskControllerReturns404ForUnknownLocation() {
        ResponseEntity<Object> response = riskController.risk("not-a-real-location");
        assertEquals(404, response.getStatusCode().value());
    }

    @Test
    void sourcesStatusControllerReturnsStatuses() {
        ResponseEntity<Object> response = sourcesController.status();
        assertEquals(200, response.getStatusCode().value());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertNotNull(body.get("data"));
    }

    @Test
    void dashboardControllerReturnsCombinedSnapshot() {
        ResponseEntity<Object> response = dashboardController.dashboard(false);
        assertEquals(200, response.getStatusCode().value());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertNotNull(body.get("data"));
    }
}
