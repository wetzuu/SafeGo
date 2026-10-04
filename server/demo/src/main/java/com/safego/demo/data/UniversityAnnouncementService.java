package com.safego.demo.data;

import com.safego.demo.model.RiskFactor;
import com.safego.demo.model.SafeGoLocation;
import com.safego.demo.model.SourceStatus;
import com.safego.demo.model.UniversityStatus;
import com.safego.demo.util.GeoUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.StringReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Looks for class-suspension notices for nearby universities when the weather or risk calls for it.
 *
 * Universities post suspensions on Facebook first, and Facebook has no public feed a server may read,
 * so this scans the public sources that carry the same decisions: the universities' own website feeds,
 * the Official Gazette, and news feeds that publish #WalangPasok lists. A notice found on a news feed
 * is a report, not the school's own post, and is marked unverified.
 */
@Service
public class UniversityAnnouncementService {

    public static final String SOURCE_KEY = "university-announcements";
    public static final String SOURCE_NAME = "University suspension scan";

    /** A scan runs once the weather factor or overall risk reaches these scores at any location. */
    static final int WEATHER_TRIGGER_SCORE = 30;
    static final int RISK_TRIGGER_SCORE = 60;
    /** Campuses are linked to SafeGo locations within this distance. */
    static final double NEARBY_KM = 2.5;

    private static final long CACHE_MS = 10 * 60_000;
    private static final long FORCED_SCAN_GAP_MS = 2 * 60_000;
    private static final Duration MAX_AGE = Duration.ofHours(36);
    private static final int MAX_BODY_CHARS = 3_000_000;
    private static final ZoneId MANILA = ZoneId.of("Asia/Manila");
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("h:mm a", Locale.ENGLISH);
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.ENGLISH);

    enum Kind { UNIVERSITY, GOVERNMENT, NEWS }
    enum Format { RSS, PUP_NEWS }

    record Campus(String id, String name, String campus, String city, double lat, double lon,
                  String logoPath, List<String> names, List<String> acronyms) {}

    record Feed(String id, String name, String url, Kind kind, Format format, List<String> campusIds) {}

    record Item(String title, String text, String link, Instant published) {}

    public record Match(String campusId, String status, String title, String link, String sourceName,
                        boolean official, boolean areaWide, String publishedAt) {}

    public record FeedReport(String id, String name, String url, String kind, boolean ok, int items, String error) {}

    /** state: "scanned", "scanning" (first scan still running), "standby" (nothing triggered a scan) or "disabled". */
    public record ScanResult(String state, String reason, String scannedAt, List<FeedReport> feeds, List<Match> matches) {}

    static final List<Campus> CAMPUSES = List.of(
        new Campus("mapua-manila", "Mapúa University", "Intramuros, Manila", "manila", 14.5907, 120.9781,
            "/university-logos/mapua.webp", List.of("mapua"), List.of()),
        new Campus("mapua-makati-campus", "Mapúa University", "Makati Campus", "makati", 14.5665, 121.0150,
            "/university-logos/mapua.webp", List.of("mapua"), List.of()),
        new Campus("ust-manila", "University of Santo Tomas", "España, Manila", "manila", 14.6096, 120.9894,
            "/university-logos/ust.png", List.of("university of santo tomas"), List.of("UST")),
        new Campus("feu-manila", "Far Eastern University", "Nicanor Reyes Street, Manila", "manila", 14.6038, 120.9865,
            "/university-logos/feu.webp", List.of("far eastern university"), List.of("FEU")),
        new Campus("ue-manila", "University of the East", "C. M. Recto Avenue, Manila", "manila", 14.6018, 120.9895,
            "/university-logos/ue.png", List.of("university of the east"), List.of("UE")),
        new Campus("ue-caloocan", "University of the East", "Caloocan Campus", "caloocan", 14.6577, 120.9838,
            "/university-logos/ue.png", List.of("university of the east"), List.of("UE")),
        new Campus("san-sebastian-manila", "San Sebastian College-Recoletos", "C. M. Recto Avenue, Manila", "manila", 14.5995, 120.9900,
            "/university-logos/sscr.png", List.of("san sebastian college"), List.of("SSC-R")),
        new Campus("uap-pasig", "University of Asia and the Pacific", "Ortigas Center, Pasig", "pasig", 14.5796, 121.0606,
            "/university-logos/uap.png", List.of("university of asia and the pacific"), List.of("UA&P")),
        new Campus("plp-pasig", "Pamantasan ng Lungsod ng Pasig", "Kapasigan, Pasig", "pasig", 14.5622, 121.0746,
            "/university-logos/plp.png", List.of("pamantasan ng lungsod ng pasig"), List.of("PLP")),
        new Campus("jru-mandaluyong", "José Rizal University", "Shaw Boulevard, Mandaluyong", "mandaluyong", 14.5935, 121.0300,
            "", List.of("jose rizal university"), List.of("JRU")),
        new Campus("pup-sta-mesa", "Polytechnic University of the Philippines", "Sta. Mesa, Manila", "manila", 14.5979, 121.0108,
            "", List.of("polytechnic university of the philippines"), List.of("PUP"))
    );

    static final List<Feed> FEEDS = List.of(
        new Feed("jru-site", "José Rizal University website", "https://jru.edu/feed/", Kind.UNIVERSITY, Format.RSS, List.of("jru-mandaluyong")),
        new Feed("pup-site", "PUP website news", "https://www.pup.edu.ph/news/", Kind.UNIVERSITY, Format.PUP_NEWS, List.of("pup-sta-mesa")),
        new Feed("feu-site", "Far Eastern University website", "https://www.feu.edu.ph/feed/", Kind.UNIVERSITY, Format.RSS, List.of("feu-manila")),
        new Feed("ue-site", "University of the East website", "https://www.ue.edu.ph/mla/feed/", Kind.UNIVERSITY, Format.RSS, List.of("ue-manila", "ue-caloocan")),
        new Feed("sscr-site", "SSC-R Manila website", "https://sscrmnl.edu.ph/feed/", Kind.UNIVERSITY, Format.RSS, List.of("san-sebastian-manila")),
        new Feed("plp-site", "Pamantasan ng Lungsod ng Pasig website", "https://plpasig.edu.ph/feed/", Kind.UNIVERSITY, Format.RSS, List.of("plp-pasig")),
        new Feed("official-gazette", "Official Gazette", "https://www.officialgazette.gov.ph/feed/", Kind.GOVERNMENT, Format.RSS, List.of()),
        new Feed("rappler", "Rappler", "https://www.rappler.com/feed/", Kind.NEWS, Format.RSS, List.of()),
        new Feed("gma-metro", "GMA News (Metro)", "https://data.gmanetwork.com/gno/rss/news/metro/feed.xml", Kind.NEWS, Format.RSS, List.of()),
        new Feed("gma-news", "GMA News", "https://data.gmanetwork.com/gno/rss/news/feed.xml", Kind.NEWS, Format.RSS, List.of()),
        new Feed("inquirer", "Inquirer.net", "https://newsinfo.inquirer.net/feed", Kind.NEWS, Format.RSS, List.of()),
        new Feed("philstar", "Philstar.com (Nation)", "https://www.philstar.com/rss/nation", Kind.NEWS, Format.RSS, List.of()),
        new Feed("manila-times", "The Manila Times", "https://www.manilatimes.net/news/feed/", Kind.NEWS, Format.RSS, List.of())
    );

    private static final Pattern SUSPENSION = Pattern.compile(
        "walang ?pasok|class(es)? suspen|suspen(sion|ded|ds|d|ding) (of )?(all )?((face-to-face|face to face|onsite|on-site|in-person) )?(class|work and class)"
            + "|no classes|classes (in [a-z ]+ )?(are |were |have been |has been )?(suspended|cancell?ed|called off)");
    private static final Pattern BODY_SUSPENSION = Pattern.compile(
        "walang ?pasok|class(es)? suspen|suspen(sion|ded|ds|d|ding) (of )?(all )?((face-to-face|face to face|onsite|on-site|in-person) )?(class|work and class)"
            + "|classes (in [a-z ]+ )?(are |were |have been |has been )?(suspended|cancell?ed|called off)");
    private static final Pattern ONLINE_SHIFT =Pattern.compile(
        "shift(s|ed|ing)? to (online|asynchronous|remote|modular)|classes (moved|shifted|go|going|held) online"
            + "|(online|asynchronous|remote|modular) (classes|learning|modality|mode)");
    private static final Pattern NOT_A_SUSPENSION = Pattern.compile("resum|lifted|no suspension|not suspended|no class suspension");
    private static final Pattern METRO_WIDE = Pattern.compile("metro manila|\\bncr\\b|national capital region");
    private static final Pattern ALL_LEVELS = Pattern.compile("all levels");
    private static final Pattern PUP_ITEM = Pattern.compile(
        "<a href=\"(/news/\\?v=[^\"]+)\"><h4>([^<]+)</h4><span>([A-Za-z]+ \\d{1,2}, \\d{4})</span>");
    private static final DateTimeFormatter PUP_DATE = DateTimeFormatter.ofPattern("MMMM d, yyyy", Locale.ENGLISH);
    private static final List<DateTimeFormatter> RSS_DATES = List.of(
        DateTimeFormatter.RFC_1123_DATE_TIME,
        DateTimeFormatter.ofPattern("EEE, d MMM yyyy HH:mm:ss Z", Locale.ENGLISH),
        DateTimeFormatter.ofPattern("EEE, d MMM yyyy HH:mm:ss z", Locale.ENGLISH),
        DateTimeFormatter.ISO_OFFSET_DATE_TIME);

    private final String mode;
    private final HttpClient http;
    private ScanResult last;
    private long lastAt;
    private boolean scanning;
    private Runnable onScanFinished = () -> {};

    @Autowired
    public UniversityAnnouncementService() {
        this(System.getenv().getOrDefault("SAFEGO_UNIVERSITY_SCAN", "auto").trim().toLowerCase(Locale.ROOT));
    }

    UniversityAnnouncementService(String mode) {
        if (!List.of("auto", "always", "disabled").contains(mode)) {
            throw new IllegalArgumentException("SAFEGO_UNIVERSITY_SCAN must be auto, always, or disabled.");
        }
        this.mode = mode;
        this.http = "disabled".equals(mode) ? null : HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(6)).followRedirects(HttpClient.Redirect.NORMAL).build();
    }

    /** A scanner that never touches the network, for tests and offline demos. */
    public static UniversityAnnouncementService disabled() {
        return new UniversityAnnouncementService("disabled");
    }

    /** Called after a background scan finishes, so its findings reach the next dashboard refresh. */
    public synchronized void onScanFinished(Runnable callback) {
        this.onScanFinished = callback;
    }

    /** Why a scan should run now, or null when conditions are calm. */
    static String trigger(List<SafeGoLocation> locations, boolean officialWeatherAlert) {
        if (officialWeatherAlert) return "A PAGASA alert is in force over a SafeGo location.";
        for (SafeGoLocation location : locations) {
            for (RiskFactor factor : location.factors()) {
                if ("Weather".equals(factor.name()) && !"Unavailable".equals(factor.pillText()) && factor.score() >= WEATHER_TRIGGER_SCORE) {
                    return "Rain or rough weather near " + location.name() + ".";
                }
            }
            if (location.risk() != null && location.risk().percentage() >= RISK_TRIGGER_SCORE) {
                return "High risk near " + location.name() + ".";
            }
        }
        return null;
    }

    /**
     * The scan for this dashboard refresh. Slow sources must not hold up the dashboard, so a triggered
     * scan runs in the background and this returns the previous findings until it finishes.
     */
    public synchronized ScanResult check(List<SafeGoLocation> locations, boolean officialWeatherAlert) {
        if ("disabled".equals(mode)) return new ScanResult("disabled", null, null, List.of(), List.of());
        // A recent scan, including one a person asked for, stays in use until it goes stale.
        if (last != null && System.currentTimeMillis() - lastAt < CACHE_MS) return last;
        String reason = "always".equals(mode) ? "Scanning is always on." : trigger(locations, officialWeatherAlert);
        if (reason == null) {
            return new ScanResult("standby", "No rain or high risk right now, so no scan was needed.", null, feedList(), List.of());
        }
        if (!scanning) {
            scanning = true;
            Thread.ofVirtual().name("university-scan").start(() -> {
                ScanResult result = fetchAll(reason);
                Runnable finished;
                synchronized (this) {
                    last = result;
                    lastAt = System.currentTimeMillis();
                    scanning = false;
                    finished = onScanFinished;
                }
                finished.run();
            });
        }
        return last != null ? last : new ScanResult("scanning", reason, null, feedList(), List.of());
    }

    /** Scan now, whatever the weather. Repeated requests within two minutes reuse the last scan. */
    public ScanResult scanNow() {
        synchronized (this) {
            if ("disabled".equals(mode)) return new ScanResult("disabled", null, null, List.of(), List.of());
            if (last != null && System.currentTimeMillis() - lastAt < FORCED_SCAN_GAP_MS) return last;
        }
        // Fetched outside the lock, so a slow source never holds up a dashboard refresh.
        ScanResult result = fetchAll("Requested from the app.");
        synchronized (this) {
            last = result;
            lastAt = System.currentTimeMillis();
        }
        return result;
    }

    /** The most recent scan, or standby when none has run. */
    public synchronized ScanResult latest() {
        if ("disabled".equals(mode)) return new ScanResult("disabled", null, null, List.of(), List.of());
        if (last != null && System.currentTimeMillis() - lastAt < CACHE_MS) return last;
        if (scanning) return new ScanResult("scanning", null, null, feedList(), List.of());
        return new ScanResult("standby", "No rain or high risk right now, so no scan was needed.", null, feedList(), List.of());
    }

    private ScanResult fetchAll(String reason) {
        Instant now = Instant.now();
        List<FeedReport> reports = new ArrayList<>();
        List<Match> matches = new ArrayList<>();
        try (ExecutorService pool = Executors.newVirtualThreadPerTaskExecutor()) {
            List<Callable<List<Item>>> jobs = new ArrayList<>();
            for (Feed feed : FEEDS) jobs.add(() -> fetch(feed));
            List<Future<List<Item>>> results = pool.invokeAll(jobs, 25, TimeUnit.SECONDS);
            for (int i = 0; i < FEEDS.size(); i++) {
                Feed feed = FEEDS.get(i);
                List<Item> items = null;
                String error = null;
                try {
                    if (results.get(i).isCancelled()) error = "Timed out.";
                    else items = results.get(i).get();
                } catch (Exception e) {
                    // An unreachable or malformed feed is reported as not ok; the others still count.
                    Throwable cause = e.getCause() == null ? e : e.getCause();
                    error = cause.getClass().getSimpleName() + (cause.getMessage() == null ? "" : ": " + cause.getMessage());
                }
                reports.add(new FeedReport(feed.id(), feed.name(), feed.url(), feed.kind().name().toLowerCase(Locale.ROOT),
                    items != null, items == null ? 0 : items.size(), error));
                if (items != null) for (Item item : items) matches.addAll(match(feed, item, now));
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        return new ScanResult("scanned", reason, now.toString(), List.copyOf(reports), best(matches));
    }

    private static List<FeedReport> feedList() {
        return FEEDS.stream().map(feed ->
            new FeedReport(feed.id(), feed.name(), feed.url(), feed.kind().name().toLowerCase(Locale.ROOT), false, 0, null)).toList();
    }

    private List<Item> fetch(Feed feed) throws Exception {
        HttpRequest request = HttpRequest.newBuilder(URI.create(feed.url()))
            .timeout(Duration.ofSeconds(20))
            .header("User-Agent", "Mozilla/5.0 (compatible; SafeGo/0.1; class-suspension check)")
            .header("Accept", "application/rss+xml, application/xml, text/xml, text/html")
            .GET().build();
        HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IllegalStateException("Source returned HTTP " + response.statusCode() + ".");
        }
        String body = response.body();
        if (body.length() > MAX_BODY_CHARS) throw new IllegalStateException("Source response is too large.");
        return feed.format() == Format.PUP_NEWS ? parsePupNews(body) : parseRss(body);
    }

    static List<Item> parseRss(String xml) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        factory.setXIncludeAware(false);
        factory.setExpandEntityReferences(false);
        NodeList nodes = factory.newDocumentBuilder().parse(new InputSource(new StringReader(xml.replace("﻿", "").strip()))).getElementsByTagName("item");
        List<Item> items = new ArrayList<>();
        for (int i = 0; i < nodes.getLength() && i < 200; i++) {
            Element element = (Element) nodes.item(i);
            String title = child(element, "title");
            String link = child(element, "link");
            if (title.isBlank() || !link.startsWith("https://")) continue;
            items.add(new Item(title, child(element, "description") + " " + child(element, "content:encoded"), link,
                parseDate(child(element, "pubDate"))));
        }
        return items;
    }

    /** PUP has no feed; its news page lists each story as a link, a heading and a date. */
    static List<Item> parsePupNews(String html) {
        Map<String, Item> items = new LinkedHashMap<>();
        Matcher matcher = PUP_ITEM.matcher(html);
        while (matcher.find() && items.size() < 100) {
            Instant published;
            try {
                published = LocalDate.parse(matcher.group(3), PUP_DATE).atStartOfDay(MANILA).toInstant();
            } catch (Exception e) {
                continue;
            }
            String link = "https://www.pup.edu.ph" + matcher.group(1).replace("&amp;", "&");
            items.putIfAbsent(link, new Item(matcher.group(2).replace("&amp;", "&").trim(), "", link, published));
        }
        return List.copyOf(items.values());
    }

    private static String child(Element parent, String tag) {
        for (Node node = parent.getFirstChild(); node != null; node = node.getNextSibling()) {
            if (node instanceof Element element && tag.equals(element.getTagName())) return element.getTextContent().trim();
        }
        return "";
    }

    private static Instant parseDate(String value) {
        for (DateTimeFormatter format : RSS_DATES) {
            try {
                return ZonedDateTime.parse(value.trim(), format).toInstant();
            } catch (Exception ignored) {
                // Try the next format.
            }
        }
        return null;
    }

    /** Lower-case text without tags, accents or styled Unicode letters, so "MAPÚA" and "𝗠𝗮𝗽𝘂𝗮" both read "mapua". */
    static String plain(String value) {
        String text = Normalizer.normalize(value.replaceAll("<[^>]*>", " "), Normalizer.Form.NFKD).replaceAll("\\p{M}+", "");
        return text.replaceAll("&[a-z#0-9]+;", " ").replaceAll("\\s+", " ").trim().toLowerCase(Locale.ROOT);
    }

    /**
     * The campuses a feed item announces a suspension for. Only items from the last 36 hours count.
     * A news or government item must name the school, or cover all levels across its city or Metro Manila.
     */
    static List<Match> match(Feed feed, Item item, Instant now) {
        if (item.published() == null || item.published().isBefore(now.minus(MAX_AGE)) || item.published().isAfter(now.plus(Duration.ofHours(1)))) {
            return List.of();
        }
        String title = plain(item.title());
        String body = plain(item.text());
        String all = title + " " + body;
        // News headlines must say it themselves; a school or government notice may say it in the body,
        // where a passing "no classes" (a holiday, say) is not enough.
        boolean inBody = feed.kind() != Kind.NEWS;
        boolean suspension = SUSPENSION.matcher(title).find() || (inBody && BODY_SUSPENSION.matcher(body).find());
        boolean online = (ONLINE_SHIFT.matcher(title).find() || (inBody && ONLINE_SHIFT.matcher(body).find())) && all.contains("class");
        if ((!suspension && !online) || NOT_A_SUSPENSION.matcher(title).find()) return List.of();

        String status = ONLINE_SHIFT.matcher(title).find() || !suspension ? "online" : "suspended";
        boolean official = feed.kind() != Kind.NEWS;
        String raw = item.title() + " " + item.text().replaceAll("<[^>]*>", " ");
        boolean allLevels = ALL_LEVELS.matcher(all).find();
        boolean metroWide = allLevels && METRO_WIDE.matcher(feed.kind() == Kind.NEWS ? title : all).find();

        List<Match> matches = new ArrayList<>();
        for (Campus campus : CAMPUSES) {
            boolean own = feed.campusIds().contains(campus.id());
            boolean named = feed.kind() != Kind.UNIVERSITY && mentions(campus, all, raw);
            boolean areaWide = feed.kind() != Kind.UNIVERSITY && !named && (metroWide || (allLevels && cityNamed(campus.city(), title)));
            if (own || named || areaWide) {
                matches.add(new Match(campus.id(), status, item.title().trim(), item.link(), feed.name(), official, areaWide,
                    item.published().toString()));
            }
        }
        return matches;
    }

    private static boolean mentions(Campus campus, String plainText, String rawText) {
        for (String name : campus.names()) {
            if (Pattern.compile("\\b" + Pattern.quote(name) + "\\b").matcher(plainText).find()) return true;
        }
        for (String acronym : campus.acronyms()) {
            if (Pattern.compile("(?<![A-Za-z0-9&-])" + Pattern.quote(acronym) + "(?![A-Za-z0-9&-])").matcher(rawText).find()) return true;
        }
        return false;
    }

    private static boolean cityNamed(String city, String plainTitle) {
        String pattern = "manila".equals(city) ? "(?<!metro )\\bmanila\\b" : "\\b" + Pattern.quote(city) + "\\b";
        return Pattern.compile(pattern).matcher(plainTitle).find();
    }

    /** One notice per campus: the school's or government's own beats a news report, then the newest wins. */
    static List<Match> best(List<Match> matches) {
        Map<String, Match> byCampus = new LinkedHashMap<>();
        for (Match match : matches) {
            Match current = byCampus.get(match.campusId());
            if (current == null || rank(match) > rank(current)
                || (rank(match) == rank(current) && match.publishedAt().compareTo(current.publishedAt()) > 0)) {
                byCampus.put(match.campusId(), match);
            }
        }
        return List.copyOf(byCampus.values());
    }

    private static int rank(Match match) {
        return (match.official() ? 2 : 0) + (match.areaWide() ? 0 : 1);
    }

    /** Adds each nearby campus to its locations, with the scan's finding or a plain "nothing found". */
    public List<SafeGoLocation> attach(List<SafeGoLocation> locations, ScanResult scan) {
        if ("disabled".equals(scan.state())) return locations;
        Map<String, Match> found = new LinkedHashMap<>();
        for (Match match : scan.matches()) found.put(match.campusId(), match);
        ZonedDateTime checked = (scan.scannedAt() == null ? Instant.now() : Instant.parse(scan.scannedAt())).atZone(MANILA);
        long reachable = scan.feeds().stream().filter(FeedReport::ok).count();

        List<SafeGoLocation> result = new ArrayList<>();
        for (SafeGoLocation location : locations) {
            Map<String, UniversityStatus> universities = new LinkedHashMap<>();
            for (UniversityStatus existing : location.universities()) universities.put(existing.id(), existing);
            for (Campus campus : CAMPUSES) {
                if (GeoUtils.distanceKm(location.coordinates(), new double[] {campus.lat(), campus.lon()}) > NEARBY_KM) continue;
                Match match = found.get(campus.id());
                if (match != null) {
                    universities.put(campus.id(), announced(campus, match));
                } else if (!universities.containsKey(campus.id())) {
                    universities.put(campus.id(), nothingFound(campus, scan, checked, reachable));
                }
            }
            result.add(new SafeGoLocation(location.id(), location.name(), location.city(), location.aliases(), location.coordinates(),
                location.updated(), location.riskSummary(), location.riskStatus(), location.stats(), location.factors(),
                location.advisories(), List.copyOf(universities.values()), location.reports(), location.points(),
                location.floods(), location.hazards(), location.risk()));
        }
        return result;
    }

    private static UniversityStatus announced(Campus campus, Match match) {
        ZonedDateTime at = Instant.parse(match.publishedAt()).atZone(MANILA);
        boolean online = "online".equals(match.status());
        String label = (online ? "Classes moved online" : "Classes suspended")
            + (match.areaWide() ? " (area-wide notice)" : match.official() ? "" : " (reported)");
        String title = match.title().length() > 220 ? match.title().substring(0, 217) + "…" : match.title();
        return new UniversityStatus(campus.id(), campus.name(), campus.campus(), campus.logoPath(), campus.name() + " logo",
            match.status(), label, title, DATE.format(at), TIME.format(at), false, match.sourceName(), match.link(), match.official());
    }

    private static UniversityStatus nothingFound(Campus campus, ScanResult scan, ZonedDateTime checked, long reachable) {
        String text = "scanned".equals(scan.state())
            ? "SafeGo checked " + reachable + " public sources at " + TIME.format(checked)
                + " and found no suspension notice for this campus. Schools often post on Facebook first, so check the official page."
            : "scanning".equals(scan.state())
                ? "SafeGo is scanning for suspension notices now. Refresh in a minute."
                : "SafeGo looks for suspension notices when there is rain or a high risk. Conditions are calm, so nothing was scanned.";
        return new UniversityStatus(campus.id(), campus.name(), campus.campus(), campus.logoPath(), campus.name() + " logo",
            "no-update", "scanned".equals(scan.state()) ? "No suspension notice found" : "Not scanned yet", text, DATE.format(checked), TIME.format(checked), false, null, null, null);
    }

    public SourceStatus status(ScanResult scan) {
        if ("scanned".equals(scan.state())) {
            boolean anyReachable = scan.feeds().stream().anyMatch(FeedReport::ok);
            return anyReachable
                ? new SourceStatus(SOURCE_KEY, SOURCE_NAME, "school", "active", scan.scannedAt(), null, null)
                : new SourceStatus(SOURCE_KEY, SOURCE_NAME, "school", "degraded", null, scan.scannedAt(), "No announcement source could be reached.");
        }
        return new SourceStatus(SOURCE_KEY, SOURCE_NAME, "school", "disabled", null, null, scan.reason());
    }
}
