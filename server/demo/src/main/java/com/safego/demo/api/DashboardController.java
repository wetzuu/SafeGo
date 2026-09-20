package com.safego.demo.api;

import com.safego.demo.data.MockRepository;
import com.safego.demo.model.DashboardSnapshot;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    @GetMapping
    public Object dashboard() {
        DashboardSnapshot snapshot = new DashboardSnapshot(
            MockRepository.listDashboardLocations(),
            MockRepository.listSourceStatuses(),
            null
        );
        return ApiResponse.ok(snapshot, "mock");
    }
}
