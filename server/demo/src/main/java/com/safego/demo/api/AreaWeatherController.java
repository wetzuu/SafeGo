package com.safego.demo.api;

import com.safego.demo.data.AreaWeatherService;
import com.safego.demo.data.DashboardService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/areas/weather")
public class AreaWeatherController {
    private final AreaWeatherService areaWeather;
    private final DashboardService dashboard;

    public AreaWeatherController(AreaWeatherService areaWeather, DashboardService dashboard) {
        this.areaWeather = areaWeather;
        this.dashboard = dashboard;
    }

    public record AreaWeatherRequest(List<AreaWeatherService.Point> points) {}

    @PostMapping
    public ResponseEntity<Object> readings(@RequestBody(required = false) AreaWeatherRequest body) {
        try {
            AreaWeatherService.validate(body == null ? null : body.points());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(400).body(ApiResponse.error("invalid_points", e.getMessage()));
        }
        AreaWeatherService.Result result = areaWeather.readings(body.points());
        return ApiResponse.noStore(ApiResponse.ok(
            Map.of("readings", result.readings(), "source", result.source()), dashboard.backend()));
    }

    /** Hour-by-hour weather for the last four days up to now per point, oldest first, for the map's time slider. */
    @PostMapping("/timeline")
    public ResponseEntity<Object> timeline(@RequestBody(required = false) AreaWeatherRequest body) {
        try {
            AreaWeatherService.validate(body == null ? null : body.points());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(400).body(ApiResponse.error("invalid_points", e.getMessage()));
        }
        AreaWeatherService.TimelineResult result = areaWeather.timeline(body.points());
        return ApiResponse.noStore(ApiResponse.ok(
            Map.of("timelines", result.timelines(), "source", result.source()), dashboard.backend()));
    }

    /** The last four complete days of weather per point, newest first. */
    @PostMapping("/history")
    public ResponseEntity<Object> history(@RequestBody(required = false) AreaWeatherRequest body) {
        try {
            AreaWeatherService.validate(body == null ? null : body.points());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(400).body(ApiResponse.error("invalid_points", e.getMessage()));
        }
        AreaWeatherService.HistoryResult result = areaWeather.history(body.points());
        return ApiResponse.noStore(ApiResponse.ok(
            Map.of("history", result.history(), "source", result.source()), dashboard.backend()));
    }
}
