package com.safego.demo.api;

import com.safego.demo.data.MockRepository;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/locations")
public class LocationRiskController {

    @GetMapping("/{id}/risk")
    public ResponseEntity<Object> risk(@PathVariable String id) {
        return MockRepository.getLocationRisk(id)
            .map(details -> LocationsController.noStore(ApiResponse.ok(details, "mock")))
            .orElseGet(() -> ResponseEntity.status(404)
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(ApiResponse.error("LOCATION_NOT_FOUND", "That SafeGo location was not found.")));
    }
}
