package com.safego.demo.data;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.safego.demo.model.*;
import org.springframework.stereotype.Service;

import java.net.HttpURLConnection;
import java.net.URI;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class OperationalFeedService {

    private static final ZoneId MANILA = ZoneId.of("Asia/Manila");
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("h:mm a", Locale.ENGLISH);
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.ENGLISH);

    private final ObjectMapper mapper;

    public OperationalFeedService() {
        this(new ObjectMapper());
    }

    public OperationalFeedService(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    public FeedResult readFeed(String key, String name, String endpointKey, String tokenKey, boolean official) {
        String endpoint = System.getenv(endpointKey);
        if (endpoint == null || endpoint.isBlank()) {
            return new FeedResult(List.of(), status(key, name, key, "disabled", null));
        }
        try {
            URI uri = URI.create(endpoint.trim());
            if (!"https".equals(uri.getScheme()) && !"localhost".equals(uri.getHost())) {
                throw new IllegalArgumentException("Feed endpoint must use HTTPS.");
            }
            JsonNode root = request(uri.toString(), System.getenv(tokenKey));
            List<JsonNode> active = parseFeedItems(root, official);
            return new FeedResult(active, status(key, name, key, "active", null));
        } catch (Exception e) {
            return new FeedResult(List.of(), status(key, name, key, "degraded", safeMessage(e)));
        }
    }

    public static List<JsonNode> parseFeedItems(JsonNode root, boolean official) {
        JsonNode items = root.path("items");
        if (!items.isArray() || items.size() > 1000) {
            throw new IllegalArgumentException("Feed response items must be an array of at most 1000 entries.");
        }
        Map<String, JsonNode> active = new LinkedHashMap<>();
        for (JsonNode item : items) {
            String id = required(item, "id", 120);
            String expiry = required(item, "expiresAt", 40);
            if (!Instant.parse(expiry).isAfter(Instant.now())) continue;
            required(item, "sourceName", 100);
            required(item, "title", 200);
            required(item, "description", 1000);
            String sourceUrl = required(item, "sourceUrl", 500);
            URI link = URI.create(sourceUrl);
            if (!"https".equals(link.getScheme()) && !"localhost".equals(link.getHost())) {
                throw new IllegalArgumentException("Feed sourceUrl must use HTTPS.");
            }
            JsonNode ids = item.path("locationIds");
            if (!ids.isArray() || ids.isEmpty() || ids.size() > 50) {
                throw new IllegalArgumentException("Feed locationIds must contain 1 to 50 IDs.");
            }
            for (JsonNode locationId : ids) {
                if (!locationId.isTextual() || locationId.asText().length() > 80) {
                    throw new IllegalArgumentException("Invalid location ID.");
                }
            }
            int severity = item.path("severityScore").asInt(-1);
            if (!item.path("severityScore").isIntegralNumber() || severity < 0 || severity > 100) {
                throw new IllegalArgumentException("Invalid severity score.");
            }
            String kind = required(item, official ? "sourceKind" : "kind", 20);
            if (official && !List.of("gov", "school", "weather").contains(kind)) {
                throw new IllegalArgumentException("Invalid advisory source kind.");
            }
            if (!official && !List.of("flood", "road").contains(kind)) {
                throw new IllegalArgumentException("Invalid flood/road kind.");
            }
            Instant.parse(required(item, official ? "issuedAt" : "observedAt", 40));
            active.put(id, item);
        }
        return List.copyOf(active.values());
    }

    public List<SafeGoLocation> applyFeed(List<SafeGoLocation> locations, List<JsonNode> all, boolean official) {
        List<SafeGoLocation> result = new ArrayList<>();
        for (SafeGoLocation location : locations) {
            List<JsonNode> items = all.stream().filter(item -> {
                for (JsonNode id : item.path("locationIds")) {
                    if (location.id().equals(id.asText())) return true;
                }
                return false;
            }).toList();
            int highest = items.stream().mapToInt(i -> i.path("severityScore").asInt()).max().orElse(0);
            String name = official ? "Official advisories" : "Flood / roads";
            String description = items.isEmpty()
                ? official ? "No active advisory for this canonical location in the configured official feed."
                           : "No active observation for this canonical location in the configured flood/road feed."
                : items.size() + (official ? " active configured official advisories; highest normalized severity "
                                           : " active verified-source observations; highest normalized severity ")
                  + highest + "/100.";
            RiskFactor factor = new RiskFactor(name, highest, bandKey(highest), bandLabel(highest), description,
                official ? "alert" : "flood", highest >= 60 ? "icon-alert" : highest >= 30 ? "icon-mod" : "icon-ok");
            List<Advisory> advisories = location.advisories();
            List<Hazard> hazards = location.hazards();
            List<Hazard> floods = location.floods();
            if (official) {
                advisories = items.stream().map(item -> {
                    ZonedDateTime at = Instant.parse(item.path("issuedAt").asText()).atZone(MANILA);
                    return new Advisory(item.path("sourceKind").asText(), item.path("sourceName").asText(),
                        item.path("title").asText(), item.path("description").asText(), TIME.format(at), DATE.format(at), false,
                        item.path("sourceUrl").asText());
                }).toList();
            } else {
                hazards = items.stream().map(this::feedHazard).toList();
                floods = items.stream().filter(i -> "flood".equals(i.path("kind").asText())).map(this::feedHazard).toList();
            }
            result.add(copy(location, location.updated(), location.riskSummary(), location.stats(),
                replace(location.factors(), factor), advisories, floods, hazards));
        }
        return result;
    }

    private Hazard feedHazard(JsonNode item) {
        int score = item.path("severityScore").asInt();
        String at = TIME.format(Instant.parse(item.path("observedAt").asText()).atZone(MANILA));
        return new Hazard(item.path("title").asText(),
            item.path("sourceName").asText() + " · " + at + " · " + item.path("description").asText(),
            score >= 60 ? "icon-alert" : score >= 30 ? "icon-mod" : "icon-ok",
            item.path("sourceUrl").asText());
    }

    private JsonNode request(String url, String token) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) URI.create(url).toURL().openConnection();
        connection.setConnectTimeout(8_000);
        connection.setReadTimeout(8_000);
        connection.setRequestProperty("Accept", "application/json");
        connection.setRequestProperty("User-Agent", "SafeGo/0.1");
        if (token != null && !token.isBlank()) {
            connection.setRequestProperty("Authorization", "Bearer " + token.trim());
        }
        try {
            int code = connection.getResponseCode();
            if (code < 200 || code >= 300) {
                throw new IllegalStateException("Source returned HTTP " + code + ".");
            }
            try (var body = connection.getInputStream()) {
                return mapper.readTree(body);
            }
        } finally {
            connection.disconnect();
        }
    }

    private static String required(JsonNode item, String field, int max) {
        JsonNode value = item.path(field);
        if (!value.isTextual() || value.asText().isBlank() || value.asText().length() > max) {
            throw new IllegalArgumentException("Invalid feed field: " + field);
        }
        return value.asText().trim();
    }

    public static SourceStatus status(String key, String name, String kind, String state, String error) {
        String now = Instant.now().toString();
        return new SourceStatus(key, name, kind, state, "active".equals(state) ? now : null,
            "degraded".equals(state) ? now : null, error);
    }

    public static String safeMessage(Exception e) {
        String message = e.getMessage();
        return message == null || message.isBlank() ? e.getClass().getSimpleName() : message;
    }

    private static List<RiskFactor> replace(List<RiskFactor> factors, RiskFactor replacement) {
        return factors.stream().map(f -> f.name().equals(replacement.name()) ? replacement : f).toList();
    }

    private static SafeGoLocation copy(SafeGoLocation source, String updated, String summary, List<Stat> stats,
            List<RiskFactor> factors, List<Advisory> advisories, List<Hazard> floods, List<Hazard> hazards) {
        return new SafeGoLocation(source.id(), source.name(), source.city(), source.aliases(), source.coordinates(), updated,
            summary, source.riskStatus(), stats, factors, advisories, source.universities(), source.reports(), source.points(),
            floods, hazards, RiskModel.analyzeRisk(factors, summary, source.riskStatus()));
    }

    private static String bandKey(int score) {
        return score <= 29 ? "low" : score <= 59 ? "mod" : score <= 79 ? "high" : "crit";
    }

    private static String bandLabel(int score) {
        return score <= 29 ? "Low" : score <= 59 ? "Moderate" : score <= 79 ? "High" : "Critical";
    }

    public record FeedResult(List<JsonNode> items, SourceStatus status) {}
}
