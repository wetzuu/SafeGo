package com.safego.demo.api;

import com.safego.demo.data.DashboardService;
import com.safego.demo.service.AccountService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class AdminControllerTest {
    private final AdminController controller = new AdminController(new AccountService(), new DashboardService());

    @AfterEach
    void reset() {
        ReportsController.reportingEnabledOverride = null;
    }

    @Test
    void adminRoutesDoNotExistWhileModerationIsOff() {
        ReportsController.reportingEnabledOverride = false;
        assertEquals(404, controller.reports(null).getStatusCode().value());
        assertEquals(404, controller.review(null, "any", Map.of("status", "verified")).getStatusCode().value());
    }

    @Test
    void adminRoutesStillRequireSignInWhenModerationIsOn() {
        ReportsController.reportingEnabledOverride = true;
        assertEquals(401, controller.reports(null).getStatusCode().value());
    }
}
