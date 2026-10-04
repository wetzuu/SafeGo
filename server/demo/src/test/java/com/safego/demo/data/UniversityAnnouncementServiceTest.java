package com.safego.demo.data;

import com.safego.demo.data.UniversityAnnouncementService.Feed;
import com.safego.demo.data.UniversityAnnouncementService.Format;
import com.safego.demo.data.UniversityAnnouncementService.Item;
import com.safego.demo.data.UniversityAnnouncementService.Kind;
import com.safego.demo.data.UniversityAnnouncementService.Match;
import com.safego.demo.model.RiskFactor;
import com.safego.demo.model.SafeGoLocation;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class UniversityAnnouncementServiceTest {

    private static final Instant NOW = Instant.parse("2026-10-04T02:00:00Z");
    private static final Feed NEWS = new Feed("news", "Example News", "https://news.example/feed", Kind.NEWS, Format.RSS, List.of());
    private static final Feed JRU = new Feed("jru-site", "José Rizal University website", "https://jru.edu/feed/", Kind.UNIVERSITY, Format.RSS, List.of("jru-mandaluyong"));

    private static Item item(String title, String text, Instant published) {
        return new Item(title, text, "https://news.example/story", published);
    }

    private static List<String> campusIds(List<Match> matches) {
        return matches.stream().map(Match::campusId).toList();
    }

    @Test
    void newsReportNamingASchoolIsAnUnverifiedSuspension() {
        List<Match> matches = UniversityAnnouncementService.match(NEWS,
            item("#WalangPasok: Class suspensions, Monday, October 5", "<p>Mapúa University – all levels</p><p>PUP Sta. Mesa</p>", NOW.minusSeconds(3600)), NOW);
        assertEquals(List.of("mapua-manila", "mapua-makati-campus", "pup-sta-mesa"), campusIds(matches));
        assertTrue(matches.stream().noneMatch(Match::official));
        assertTrue(matches.stream().allMatch(match -> "suspended".equals(match.status())));
    }

    @Test
    void acronymsMatchOnlyAsWholeUpperCaseWords() {
        List<Match> matches = UniversityAnnouncementService.match(NEWS,
            item("Classes suspended in several schools", "Students must adjust. The pupils of FEUdal High and a trust fund were named.", NOW), NOW);
        assertTrue(matches.isEmpty());
    }

    @Test
    void theUniversitysOwnFeedIsOfficialAndReadsStyledText() {
        List<Match> matches = UniversityAnnouncementService.match(JRU,
            item("𝗔𝗗𝗩𝗜𝗦𝗢𝗥𝗬", "Classes are suspended today, October 4, due to heavy rainfall.", NOW.minusSeconds(600)), NOW);
        assertEquals(List.of("jru-mandaluyong"), campusIds(matches));
        assertTrue(matches.get(0).official());
    }

    @Test
    void shiftToOnlineIsReportedAsOnline() {
        List<Match> matches = UniversityAnnouncementService.match(JRU,
            item("Classes shift to online modality on October 4", "", NOW.minusSeconds(600)), NOW);
        assertEquals("online", matches.get(0).status());
    }

    @Test
    void oldResumptionAndUnrelatedItemsAreIgnored() {
        assertTrue(UniversityAnnouncementService.match(JRU, item("Classes suspended", "", NOW.minusSeconds(3 * 86_400)), NOW).isEmpty());
        assertTrue(UniversityAnnouncementService.match(JRU, item("Classes resume after class suspension", "", NOW), NOW).isEmpty());
        assertTrue(UniversityAnnouncementService.match(JRU, item("Rain or Shine: Tindahan ni Rizal", "No classes on the holiday.", NOW), NOW).isEmpty());
        assertTrue(UniversityAnnouncementService.match(NEWS, item("UST wins title", "Earlier, classes were suspended.", NOW), NOW).isEmpty());
        assertTrue(UniversityAnnouncementService.match(JRU, item("Classes suspended", "", null), NOW).isEmpty());
    }

    @Test
    void cityWideAllLevelsNoticeCoversOnlyThatCitysCampuses() {
        List<Match> pasig = UniversityAnnouncementService.match(NEWS,
            item("Pasig suspends classes on Monday", "Classes at all levels, public and private, are suspended.", NOW), NOW);
        assertEquals(List.of("uap-pasig", "plp-pasig"), campusIds(pasig));
        assertTrue(pasig.stream().allMatch(Match::areaWide));

        List<Match> metro = UniversityAnnouncementService.match(NEWS,
            item("Walang pasok in Metro Manila on Monday", "All levels are covered.", NOW), NOW);
        assertEquals(UniversityAnnouncementService.CAMPUSES.size(), metro.size());

        // "Metro Manila" in a headline is not the City of Manila, and no "all levels" means no blanket match.
        assertTrue(UniversityAnnouncementService.match(NEWS, item("Marikina suspends classes", "Preschool to senior high only.", NOW), NOW).isEmpty());
    }

    @Test
    void theSchoolsOwnNoticeBeatsANewsReport() {
        Match news = new Match("jru-mandaluyong", "suspended", "report", "https://a.example", "Example News", false, false, "2026-10-04T01:30:00Z");
        Match own = new Match("jru-mandaluyong", "online", "notice", "https://jru.edu/x", "JRU", true, false, "2026-10-04T01:00:00Z");
        assertEquals(List.of(own), UniversityAnnouncementService.best(List.of(news, own)));
    }

    @Test
    void parsesRssAndThePupNewsPage() throws Exception {
        String rss = """
            <?xml version="1.0" encoding="UTF-8"?><?xml-stylesheet type="text/xsl" href="x.xsl"?>
            <rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>Feed</title>
            <item><title><![CDATA[Classes suspended]]></title><link>https://jru.edu/a</link>
            <pubDate>Sun, 4 Oct 2026 09:30:00 +0800</pubDate><description>Heavy rain</description><content:encoded><![CDATA[<p>Body</p>]]></content:encoded></item>
            <item><title>No link</title><link>http://insecure.example</link></item>
            </channel></rss>
            """;
        List<Item> items = UniversityAnnouncementService.parseRss(rss);
        assertEquals(1, items.size());
        assertEquals(Instant.parse("2026-10-04T01:30:00Z"), items.get(0).published());
        assertTrue(items.get(0).text().contains("Body"));
        assertThrows(Exception.class, () -> UniversityAnnouncementService.parseRss("<!DOCTYPE rss [<!ENTITY x SYSTEM \"file:///etc/passwd\">]><rss/>"));

        String html = "<a href=\"/news/?v=Advisory-1&go=abc\"><div class=\"thumb\"></div></a>"
            + "<a href=\"/news/?v=Advisory-1&go=abc\"><h4>Suspension of classes, October 4</h4><span>October 04, 2026</span> </a>";
        List<Item> pup = UniversityAnnouncementService.parsePupNews(html);
        assertEquals(1, pup.size());
        assertEquals("https://www.pup.edu.ph/news/?v=Advisory-1&go=abc", pup.get(0).link());
        assertEquals(Instant.parse("2026-10-03T16:00:00Z"), pup.get(0).published());
    }

    @Test
    void scansOnlyWhenThereIsRainAnAlertOrHighRisk() {
        SafeGoLocation calm = location(10);
        assertNull(UniversityAnnouncementService.trigger(List.of(calm), false));
        assertNotNull(UniversityAnnouncementService.trigger(List.of(calm), true));
        assertNotNull(UniversityAnnouncementService.trigger(List.of(calm, location(45)), false));
    }

    @Test
    void aDisabledScannerLeavesLocationsAlone() {
        UniversityAnnouncementService service = UniversityAnnouncementService.disabled();
        List<SafeGoLocation> locations = List.of(location(80));
        UniversityAnnouncementService.ScanResult scan = service.check(locations, true);
        assertEquals("disabled", scan.state());
        assertSame(locations, service.attach(locations, scan));
        assertEquals("disabled", service.status(scan).status());
    }

    @Test
    void attachesNearbyCampusesWithTheScanFinding() {
        UniversityAnnouncementService service = new UniversityAnnouncementService("auto");
        Match match = new Match("ust-manila", "suspended", "UST suspends classes", "https://news.example/ust", "Example News", false, false, "2026-10-04T01:30:00Z");
        var scan = new UniversityAnnouncementService.ScanResult("scanned", "test", "2026-10-04T02:00:00Z",
            List.of(new UniversityAnnouncementService.FeedReport("news", "Example News", "https://news.example/feed", "news", true, 3, null)), List.of(match));
        SafeGoLocation espana = service.attach(List.of(location(45)), scan).get(0);

        var ust = espana.universities().stream().filter(u -> u.id().equals("ust-manila")).findFirst().orElseThrow();
        assertEquals("suspended", ust.status());
        assertEquals("Oct 4, 2026", ust.date());
        assertFalse(ust.isMock());
        assertEquals(Boolean.FALSE, ust.announcementVerified());
        var feu = espana.universities().stream().filter(u -> u.id().equals("feu-manila")).findFirst().orElseThrow();
        assertEquals("no-update", feu.status());
        assertTrue(espana.universities().stream().noneMatch(u -> u.id().equals("plp-pasig")));
    }

    /** A location at España Blvd. with the given live weather score. */
    private static SafeGoLocation location(int weatherScore) {
        List<RiskFactor> factors = List.of(new RiskFactor("Weather", weatherScore, "low", "Live", "", "weather", "icon-ok"));
        return new SafeGoLocation("espana", "España Blvd., Sampaloc", "Manila", List.of(), new double[] {14.612, 120.9902},
            "", "", "", List.of(), factors, List.of(), List.of(), List.of(), List.of(), List.of(), List.of(),
            RiskModel.analyzeRisk(factors, "", ""));
    }
}
