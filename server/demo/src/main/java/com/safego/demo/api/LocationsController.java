package com.safego.demo.api;

import com.safego.demo.data.MockRepository;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/locations")
public class LocationsController {

    @GetMapping
    public ResponseEntity<Object> list() {
        return noStore(ApiResponse.ok(MockRepository.listLocations(), "mock"));
    }

    static ResponseEntity<Object> noStore(Object body) {
        return ResponseEntity.ok()
            .header(HttpHeaders.CACHE_CONTROL, "no-store")
            .body(body);
    }
}
