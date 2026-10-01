package com.safego.demo.api;

import com.safego.demo.data.DashboardService;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class LocationsControllersTest {

    private final DashboardService dashboard = new DashboardService();
    private final DashboardController dashboardController = new DashboardController(dashboard);
    private final HealthController healthController = new HealthController(dashboard);

    @Test
    void dashboardControllerReturnsCombinedSnapshot() {
        ResponseEntity<Object> response = dashboardController.dashboard(false);
        assertEquals(200, response.getStatusCode().value());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertNotNull(body.get("data"));
    }

    @Test
    void healthControllerReportsReadyWithoutCallingExternalProviders() {
        ResponseEntity<Object> response = healthController.health();
        assertEquals(200, response.getStatusCode().value());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) body.get("data");
        assertEquals("ready", data.get("status"));
        assertEquals("safego-api", data.get("service"));
    }
}
