package com.safego.demo.data;

import com.safego.demo.model.SourceStatus;
import org.springframework.stereotype.Service;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Reads PAGASA's public Common Alerting Protocol feed (https://publicalert.pagasa.dost.gov.ph/feeds/,
 * CC BY 4.0): general flood advisories, flood bulletins and tropical cyclone alerts, each with the
 * polygons of the areas it covers. Only active alerts are returned: not expired, not cancelled,
 * not an all-clear, and not superseded by a newer alert that references them.
 */
@Service
public class PagasaCapService {

    public static final String DEFAULT_FEED = "https://publicalert.pagasa.dost.gov.ph/feeds/";
    public static final String SOURCE_KEY = "pagasa-cap";
    public static final String SOURCE_NAME = "PAGASA public alerts (CAP, CC BY 4.0)";
    private static final long FEED_CACHE_MS = 5 * 60 * 1000;
    private static final int MAX_ENTRIES = 60;
    private static final int MAX_CACHED_ALERTS = 400;
    private static final int MAX_DOCUMENT_BYTES = 2_000_000;

    public record Area(String description, List<List<double[]>> polygons) {}

    public record CapAlert(
        String id,
        String event,
        String headline,
        String description,
        String severity,
        String urgency,
        String certainty,
        String responseType,
        String msgType,
        String status,
        String scope,
        Instant sent,
        Instant expires,
        String sourceUrl,
        Set<String> references,
        List<Area> areas
    ) {}

    public record Result(List<CapAlert> alerts, SourceStatus status) {}

    private final String feedUrl;
    private final Map<String, CapAlert> documents = new ConcurrentHashMap<>();
    private Result cached;
    private long cachedUntil;

    public PagasaCapService() {
        this(System.getenv().getOrDefault("SAFEGO_PAGASA_CAP_FEED_URL", DEFAULT_FEED));
    }

    public PagasaCapService(String feedUrl) {
        this.feedUrl = feedUrl == null ? "" : feedUrl.trim();
    }

    /** A reader that never touches the network, for tests and offline demos. */
    public static PagasaCapService disabled() {
        return new PagasaCapService("disabled");
    }

    public synchronized Result activeAlerts() {
        if (feedUrl.isEmpty() || "disabled".equalsIgnoreCase(feedUrl)) {
            return new Result(List.of(), OperationalFeedService.status(SOURCE_KEY, SOURCE_NAME, "official", "disabled", null));
        }
        if (cached != null && System.currentTimeMillis() < cachedUntil) return cached;
        try {
            URI feed = URI.create(feedUrl);
            if (!"https".equals(feed.getScheme()) && !"localhost".equals(feed.getHost())) {
                throw new IllegalArgumentException("PAGASA feed must use HTTPS.");
            }
            List<CapAlert> alerts = new ArrayList<>();
            for (String capUrl : parseFeedLinks(fetch(feed.toString()))) {
                // Only follow alerts hosted by the feed's own publisher.
                if (!Objects.equals(URI.create(capUrl).getHost(), feed.getHost())) continue;
                CapAlert alert = documents.get(capUrl);
                if (alert == null) {
                    alert = parseCap(fetch(capUrl), capUrl);
                    if (documents.size() >= MAX_CACHED_ALERTS) documents.clear();
                    documents.put(capUrl, alert);
                }
                alerts.add(alert);
            }
            cached = new Result(active(alerts, Instant.now()), new SourceStatus(SOURCE_KEY, SOURCE_NAME, "official", "active",
                Instant.now().toString(), null, null));
        } catch (Exception e) {
            cached = new Result(List.of(), OperationalFeedService.status(SOURCE_KEY, SOURCE_NAME, "official", "degraded",
                OperationalFeedService.safeMessage(e)));
        }
        cachedUntil = System.currentTimeMillis() + FEED_CACHE_MS;
        return cached;
    }

    /** Alerts still in force at {@code now}, with superseded, cancelled and all-clear messages removed. */
    public static List<CapAlert> active(List<CapAlert> alerts, Instant now) {
        Set<String> superseded = new HashSet<>();
        for (CapAlert alert : alerts) superseded.addAll(alert.references());
        Map<String, CapAlert> unique = new LinkedHashMap<>();
        for (CapAlert alert : alerts) {
            if (superseded.contains(alert.id())) continue;
            if (!"Actual".equals(alert.status()) || !"Public".equals(alert.scope())) continue;
            if ("Cancel".equals(alert.msgType()) || "Past".equals(alert.urgency()) || "AllClear".equals(alert.responseType())) continue;
            if (alert.expires() == null || !alert.expires().isAfter(now)) continue;
            unique.putIfAbsent(alert.id(), alert);
        }
        return List.copyOf(unique.values());
    }

    /**
     * SafeGo's 0–100 mapping of CAP severity, documented in docs/SOURCE_FEEDS.md. Unknown severity is
     * treated like Minor rather than zero, because an active official alert is never "no risk".
     */
    public static int severityScore(CapAlert alert) {
        return switch (alert.severity() == null ? "" : alert.severity()) {
            case "Extreme" -> 90;
            case "Severe" -> 70;
            case "Moderate" -> 45;
            default -> 25;
        };
    }

    public static boolean covers(CapAlert alert, double latitude, double longitude) {
        for (Area area : alert.areas()) {
            for (List<double[]> polygon : area.polygons()) {
                if (contains(polygon, latitude, longitude)) return true;
            }
        }
        return false;
    }

    public static boolean contains(List<double[]> polygon, double latitude, double longitude) {
        boolean inside = false;
        for (int i = 0, j = polygon.size() - 1; i < polygon.size(); j = i++) {
            double[] a = polygon.get(i);
            double[] b = polygon.get(j);
            if ((a[0] > latitude) != (b[0] > latitude)
                && longitude < (b[1] - a[1]) * (latitude - a[0]) / (b[0] - a[0]) + a[1]) {
                inside = !inside;
            }
        }
        return inside;
    }

    public static List<String> parseFeedLinks(String atom) throws Exception {
        Document document = parse(atom);
        List<String> links = new ArrayList<>();
        NodeList entries = document.getElementsByTagNameNS("*", "entry");
        for (int i = 0; i < entries.getLength() && links.size() < MAX_ENTRIES; i++) {
            NodeList entryLinks = ((Element) entries.item(i)).getElementsByTagNameNS("*", "link");
            for (int j = 0; j < entryLinks.getLength(); j++) {
                Element link = (Element) entryLinks.item(j);
                String href = link.getAttribute("href");
                if (href.startsWith("https://") && ("application/cap+xml".equals(link.getAttribute("type")) || href.endsWith(".cap"))) {
                    links.add(href);
                    break;
                }
            }
        }
        return links;
    }

    public static CapAlert parseCap(String xml, String sourceUrl) throws Exception {
        Element alert = parse(xml).getDocumentElement();
        Element info = first(alert, "info");
        if (info == null) throw new IllegalArgumentException("CAP alert has no info block.");

        Set<String> references = new HashSet<>();
        // CAP references are space-separated "sender,identifier,sent" triples.
        for (String reference : text(alert, "references").split("\\s+")) {
            String[] parts = reference.split(",");
            if (parts.length >= 2) references.add(parts[1]);
        }

        List<Area> areas = new ArrayList<>();
        NodeList areaNodes = info.getElementsByTagNameNS("*", "area");
        for (int i = 0; i < areaNodes.getLength(); i++) {
            Element area = (Element) areaNodes.item(i);
            List<List<double[]>> polygons = new ArrayList<>();
            NodeList polygonNodes = area.getElementsByTagNameNS("*", "polygon");
            for (int j = 0; j < polygonNodes.getLength(); j++) {
                List<double[]> polygon = parsePolygon(polygonNodes.item(j).getTextContent());
                if (polygon.size() >= 3) polygons.add(polygon);
            }
            areas.add(new Area(text(area, "areaDesc"), polygons));
        }

        String web = text(info, "web");
        String description = text(info, "description").replace("\r", "").trim();
        return new CapAlert(
            text(alert, "identifier"),
            text(info, "event"),
            text(info, "headline").isBlank() ? text(info, "event") : text(info, "headline"),
            description.length() > 600 ? description.substring(0, 597) + "…" : description,
            text(info, "severity"),
            text(info, "urgency"),
            text(info, "certainty"),
            text(info, "responseType"),
            text(alert, "msgType"),
            text(alert, "status"),
            text(alert, "scope"),
            time(text(alert, "sent")),
            time(text(info, "expires")),
            web.startsWith("https://") ? web : sourceUrl,
            Set.copyOf(references),
            List.copyOf(areas)
        );
    }

    // CAP polygons are space-separated "latitude,longitude" pairs.
    private static List<double[]> parsePolygon(String text) {
        List<double[]> points = new ArrayList<>();
        for (String pair : text.trim().split("\\s+")) {
            String[] parts = pair.split(",");
            if (parts.length != 2) continue;
            try {
                points.add(new double[] {Double.parseDouble(parts[0]), Double.parseDouble(parts[1])});
            } catch (NumberFormatException ignored) {
                // Skip malformed coordinates rather than rejecting the whole alert.
            }
        }
        return points;
    }

    private static Document parse(String xml) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        // External feeds are untrusted: forbid DTDs and external entities (XXE).
        factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
        factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
        factory.setXIncludeAware(false);
        factory.setExpandEntityReferences(false);
        DocumentBuilder builder = factory.newDocumentBuilder();
        return builder.parse(new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8)));
    }

    private static Element first(Element parent, String name) {
        NodeList nodes = parent.getElementsByTagNameNS("*", name);
        return nodes.getLength() == 0 ? null : (Element) nodes.item(0);
    }

    // Text of a direct child element, so <info>'s fields are not confused with nested ones.
    private static String text(Element parent, String name) {
        for (Node child = parent.getFirstChild(); child != null; child = child.getNextSibling()) {
            if (child instanceof Element element && name.equals(element.getLocalName())) {
                return element.getTextContent().trim();
            }
        }
        return "";
    }

    private static Instant time(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return OffsetDateTime.parse(value).toInstant();
        } catch (Exception e) {
            return null;
        }
    }

    private static String fetch(String url) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) URI.create(url).toURL().openConnection();
        connection.setConnectTimeout(8_000);
        connection.setReadTimeout(10_000);
        connection.setInstanceFollowRedirects(false);
        connection.setRequestProperty("Accept", "application/atom+xml, application/cap+xml, application/xml");
        connection.setRequestProperty("User-Agent", "SafeGo/0.1");
        try {
            int code = connection.getResponseCode();
            if (code < 200 || code >= 300) throw new IllegalStateException("PAGASA returned HTTP " + code + ".");
            try (var body = connection.getInputStream()) {
                byte[] bytes = body.readNBytes(MAX_DOCUMENT_BYTES + 1);
                if (bytes.length > MAX_DOCUMENT_BYTES) throw new IllegalStateException("PAGASA document is too large.");
                return new String(bytes, StandardCharsets.UTF_8);
            }
        } finally {
            connection.disconnect();
        }
    }
}
