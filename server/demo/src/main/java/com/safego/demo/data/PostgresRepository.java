package com.safego.demo.data;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.safego.demo.model.*;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.sql.*;
import java.util.*;

/** Reads the same PostGIS schema seeded by the existing npm db:setup command. */
public class PostgresRepository {
    private static final String DASHBOARD_QUERY = """
        SELECT l.id, l.name, l.city, l.aliases, ST_Y(l.position::geometry) AS latitude,
          ST_X(l.position::geometry) AS longitude, l.updated_label, l.display_payload::text AS display_payload,
          latest.assessment::text AS assessment, latest.factors::text AS factors,
          COALESCE((SELECT jsonb_agg(a.payload ORDER BY a.issued_at DESC) FROM advisories a
            WHERE a.location_id = l.id), '[]'::jsonb)::text AS advisories,
          COALESCE((SELECT jsonb_agg(r.payload ORDER BY r.reported_at DESC) FROM community_reports r
            WHERE r.location_id = l.id), '[]'::jsonb)::text AS community_reports
        FROM locations l
        JOIN LATERAL (SELECT assessment, factors FROM risk_assessments
          WHERE location_id = l.id ORDER BY calculated_at DESC LIMIT 1) latest ON true
        ORDER BY l.name
        """;

    private final ObjectMapper mapper = new ObjectMapper();
    private final String jdbcUrl;
    private final Properties properties = new Properties();

    public PostgresRepository(String databaseUrl) {
        if (databaseUrl.startsWith("jdbc:postgresql:")) {
            jdbcUrl = databaseUrl;
        } else {
            URI uri = URI.create(databaseUrl);
            if (!List.of("postgres", "postgresql").contains(uri.getScheme())) throw new IllegalArgumentException("DATABASE_URL must be a PostgreSQL URL.");
            String userInfo = uri.getRawUserInfo();
            if (userInfo != null) {
                String[] parts = userInfo.split(":", 2);
                properties.setProperty("user", URLDecoder.decode(parts[0], StandardCharsets.UTF_8));
                if (parts.length > 1) properties.setProperty("password", URLDecoder.decode(parts[1], StandardCharsets.UTF_8));
            }
            jdbcUrl = "jdbc:postgresql://" + uri.getHost() + (uri.getPort() > 0 ? ":" + uri.getPort() : "")
                + uri.getRawPath() + (uri.getRawQuery() != null ? "?" + uri.getRawQuery() : "");
        }
        properties.setProperty("connectTimeout", "8");
        if ("true".equalsIgnoreCase(System.getenv("DATABASE_SSL"))) properties.setProperty("sslmode", "require");
    }

    public List<SafeGoLocation> listDashboardLocations() {
        List<SafeGoLocation> locations = new ArrayList<>();
        try (Connection connection = connect(); PreparedStatement statement = connection.prepareStatement(DASHBOARD_QUERY);
             ResultSet rows = statement.executeQuery()) {
            while (rows.next()) {
                ObjectNode payload = (ObjectNode) mapper.readTree(rows.getString("display_payload"));
                payload.put("id", rows.getString("id"));
                payload.put("name", rows.getString("name"));
                payload.put("city", rows.getString("city"));
                payload.set("aliases", mapper.valueToTree(Arrays.asList((String[]) rows.getArray("aliases").getArray())));
                payload.set("coordinates", mapper.valueToTree(new double[] {rows.getDouble("latitude"), rows.getDouble("longitude")}));
                payload.put("updated", rows.getString("updated_label"));
                payload.set("risk", mapper.readTree(rows.getString("assessment")));
                payload.set("factors", mapper.readTree(rows.getString("factors")));
                payload.set("advisories", mapper.readTree(rows.getString("advisories")));
                payload.set("reports", mapper.readTree(rows.getString("community_reports")));
                if (!payload.has("universities")) payload.putArray("universities");
                locations.add(mapper.treeToValue(payload, SafeGoLocation.class));
            }
            return locations;
        } catch (Exception e) {
            throw new IllegalStateException("Could not load SafeGo locations from PostgreSQL: " + e.getMessage(), e);
        }
    }

    public List<SourceStatus> listSourceStatuses() {
        List<SourceStatus> sources = new ArrayList<>();
        try (Connection connection = connect(); PreparedStatement statement = connection.prepareStatement(
                 "SELECT key, name, kind, status, last_success_at, last_failure_at, error_message FROM data_sources ORDER BY name");
             ResultSet rows = statement.executeQuery()) {
            while (rows.next()) {
                Timestamp success = rows.getTimestamp("last_success_at");
                Timestamp failure = rows.getTimestamp("last_failure_at");
                sources.add(new SourceStatus(rows.getString("key"), rows.getString("name"), rows.getString("kind"),
                    rows.getString("status"), success == null ? null : success.toInstant().toString(),
                    failure == null ? null : failure.toInstant().toString(), rows.getString("error_message")));
            }
            return sources;
        } catch (Exception e) {
            throw new IllegalStateException("Could not load SafeGo sources from PostgreSQL: " + e.getMessage(), e);
        }
    }

    public Optional<CommunityReport> submitCommunityReport(String locationId, String reportType, String locationText, String description) {
        CommunityReport report = new CommunityReport(reportType, description, locationText + " · "
            + java.time.format.DateTimeFormatter.ofPattern("h:mm a").format(java.time.ZonedDateTime.now(java.time.ZoneId.of("Asia/Manila"))),
            "unverified", "UNVERIFIED");
        String sql = """
            INSERT INTO community_reports (location_id, report_type, title, verification_status, payload,
              position, reported_at, submission_source)
            SELECT id, ?, ?, 'unverified', ?::jsonb, position, NOW(), 'community'
            FROM locations WHERE id = ?
            """;
        try (Connection connection = connect(); PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, reportType);
            statement.setString(2, description);
            statement.setString(3, mapper.writeValueAsString(report));
            statement.setString(4, locationId);
            return statement.executeUpdate() == 0 ? Optional.empty() : Optional.of(report);
        } catch (Exception e) {
            throw new IllegalStateException("Could not save the community report: " + e.getMessage(), e);
        }
    }

    private Connection connect() throws SQLException {
        return DriverManager.getConnection(jdbcUrl, properties);
    }
}
