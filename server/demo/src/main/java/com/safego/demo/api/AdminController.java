package com.safego.demo.api;

import com.safego.demo.data.DashboardService;
import com.safego.demo.model.AccountProfile;
import com.safego.demo.model.ReportEntry;
import com.safego.demo.service.AccountService;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Moderation of community reports. Only accounts listed in SAFEGO_ADMIN_EMAILS may use it, and only while
 * community reporting and moderation are both enabled; otherwise every route answers 404.
 */
@RestController
@RequestMapping("/api/admin")
public class AdminController {
    private static final List<String> STATUSES = List.of("unverified", "verified", "rejected");

    private final AccountService accounts;
    private final DashboardService dashboard;

    public AdminController(AccountService accounts, DashboardService dashboard) {
        this.accounts = accounts;
        this.dashboard = dashboard;
    }

    /** Every community report, newest first, including rejected ones. */
    @GetMapping("/reports")
    public ResponseEntity<Object> reports(@CookieValue(value = "SAFEGO_SESSION", required = false) String token) {
        ResponseEntity<Object> denied = denyUnlessAdmin(token);
        if (denied != null) return denied;
        return noStore(ResponseEntity.ok(ApiResponse.ok(Map.of("reports", dashboard.listReportEntries()), dashboard.backend())));
    }

    /** Marks a report verified or rejected, or puts it back to unverified. */
    @PutMapping("/reports/{id}")
    public ResponseEntity<Object> review(@CookieValue(value = "SAFEGO_SESSION", required = false) String token,
            @PathVariable String id, @RequestBody(required = false) Map<String, Object> body) {
        ResponseEntity<Object> denied = denyUnlessAdmin(token);
        if (denied != null) return denied;
        String status = body == null || body.get("status") == null ? "" : String.valueOf(body.get("status")).trim();
        if (!STATUSES.contains(status)) {
            return noStore(ResponseEntity.status(400).body(ApiResponse.error("INVALID_STATUS", "Status must be unverified, verified, or rejected.")));
        }
        String reviewer = accounts.session(token).map(AccountProfile::email).orElse("admin");
        Optional<ReportEntry> updated = dashboard.reviewReport(id, status, reviewer);
        return updated
            .map(entry -> noStore(ResponseEntity.ok(ApiResponse.ok(entry, dashboard.backend()))))
            .orElseGet(() -> noStore(ResponseEntity.status(404).body(ApiResponse.error("REPORT_NOT_FOUND", "That report no longer exists."))));
    }

    private ResponseEntity<Object> denyUnlessAdmin(String token) {
        if (!ReportsController.isReportingEnabled()) {
            return noStore(ResponseEntity.status(404).body(ApiResponse.error("NOT_FOUND", "Not found.")));
        }
        Optional<AccountProfile> profile;
        try {
            profile = accounts.session(token);
        } catch (AccountService.AccountException e) {
            return noStore(ResponseEntity.status(503).body(ApiResponse.error(e.code, e.getMessage())));
        }
        if (profile.isEmpty()) {
            return noStore(ResponseEntity.status(401).body(ApiResponse.error("UNAUTHENTICATED", "Sign in with an admin account.")));
        }
        if (!profile.get().admin()) {
            return noStore(ResponseEntity.status(403).body(ApiResponse.error("FORBIDDEN", "This account is not a SafeGo admin.")));
        }
        return null;
    }

    private static ResponseEntity<Object> noStore(ResponseEntity<Object> response) {
        response.getHeaders().setCacheControl(CacheControl.noStore());
        return response;
    }
}
