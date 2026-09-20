package com.safego.demo.api;

import com.safego.demo.data.MockRepository;
import com.safego.demo.model.DashboardSnapshot;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/sources/status")
public class SourcesStatusController {

    @GetMapping
    public Object status() {
        return ApiResponse.ok(MockRepository.listSourceStatuses(), "mock");
    }
}
