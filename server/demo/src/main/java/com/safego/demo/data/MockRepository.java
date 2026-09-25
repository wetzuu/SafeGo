package com.safego.demo.data;

import com.safego.demo.model.*;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

public final class MockRepository {

    private static final String DEMO_DATE = "Sep 14, 2026";
    private static final int MAX_SESSION_REPORTS_PER_LOCATION = 100;
    private static final Map<String, List<CommunityReport>> submittedReports = new LinkedHashMap<>();

    private static final List<SafeGoLocation> LOCATIONS;

    static {
        SafeGoLocation espana = buildEspana();
        LOCATIONS = List.of(
            espana,
            buildMakati(),
            buildQuiapo(),
            buildLerma(),
            cloneEspana(espana, "binondo", "Binondo, Manila", "Manila",
                List.of("binondo", "manila", "divisoria", "ongpin"),
                new double[]{14.601, 120.9745}),
            cloneEspana(espana, "katipunan", "Katipunan Avenue, Quezon City", "Quezon City",
                List.of("katipunan", "quezon city", "qc", "ateneo", "up diliman"),
                new double[]{14.6405, 121.0741}),
            buildPasig()
        );
    }

    private MockRepository() {}

    public static List<LocationSummary> listLocations() {
        return LOCATIONS.stream().map(MockRepository::summarize).toList();
    }

    public static List<SafeGoLocation> listDashboardLocations() {
        return LOCATIONS.stream()
            .map(loc -> withSubmittedReports(loc))
            .toList();
    }

    public static Optional<LocationRiskDetails> getLocationRisk(String id) {
        return LOCATIONS.stream()
            .filter(loc -> loc.id().equals(id))
            .findFirst()
            .map(loc -> new LocationRiskDetails(
                summarize(loc),
                loc.risk(),
                loc.factors(),
                loc.advisories(),
                reportsFor(loc)
            ));
    }

    public static List<SourceStatus> listSourceStatuses() {
        return List.of(new SourceStatus(
            "prototype-mock",
            "SafeGo prototype dataset",
            "mock",
            "mock",
            null, null, null
        ));
    }

    public static Optional<CommunityReport> submitCommunityReport(
            String locationId, String reportType, String locationText, String description) {

        boolean exists = LOCATIONS.stream().anyMatch(loc -> loc.id().equals(locationId));
        if (!exists) return Optional.empty();

        ZonedDateTime now = ZonedDateTime.now(ZoneId.of("Asia/Manila"));
        String time = DateTimeFormatter.ofPattern("h:mm a").format(now);
        CommunityReport report = new CommunityReport(
            reportType,
            description,
            locationText + " · " + time,
            "unverified",
            "UNVERIFIED"
        );

        submittedReports.compute(locationId, (key, existing) -> {
            List<CommunityReport> updated = new ArrayList<>();
            updated.add(report);
            if (existing != null) updated.addAll(existing);
            return updated.stream().limit(MAX_SESSION_REPORTS_PER_LOCATION).toList();
        });

        return Optional.of(report);
    }

    private static List<CommunityReport> reportsFor(SafeGoLocation loc) {
        List<CommunityReport> result = new ArrayList<>();
        List<CommunityReport> submitted = submittedReports.get(loc.id());
        if (submitted != null) result.addAll(submitted);
        result.addAll(loc.reports());
        return Collections.unmodifiableList(result);
    }

    private static SafeGoLocation withSubmittedReports(SafeGoLocation loc) {
        List<CommunityReport> merged = reportsFor(loc);
        if (merged.size() == loc.reports().size()) return loc;
        return new SafeGoLocation(
            loc.id(), loc.name(), loc.city(), loc.aliases(), loc.coordinates(),
            loc.updated(), loc.riskSummary(), loc.riskStatus(),
            loc.stats(), loc.factors(), loc.advisories(), loc.universities(),
            merged, loc.points(), loc.floods(), loc.hazards(), loc.risk()
        );
    }

    private static LocationSummary summarize(SafeGoLocation loc) {
        RiskAssessment r = loc.risk();
        return new LocationSummary(
            loc.id(), loc.name(), loc.city(), loc.aliases(), loc.coordinates(), loc.updated(),
            new LocationSummary.RiskSummary(r.key(), r.name(), r.rank(), r.percentage(), r.modelVersion())
        );
    }

    private static SafeGoLocation create(
        String id, String name, String city, List<String> aliases, double[] coordinates,
        String updated, String riskSummary, String riskStatus,
        List<Stat> stats, List<RiskFactor> factors,
        List<Advisory> rawAdvisories,
        List<UniversityStatus> universities,
        List<CommunityReport> reports,
        List<RoutePoint> points, List<Hazard> floods, List<Hazard> hazards
    ) {
        List<Advisory> advisories = rawAdvisories.stream()
            .map(a -> a.date() != null ? a : new Advisory(
                a.source(), a.label(), a.title(), a.description(), a.time(), DEMO_DATE, a.isMock()))
            .toList();

        RiskAssessment risk = RiskModel.analyzeRisk(factors, riskSummary, riskStatus);
        return new SafeGoLocation(
            id, name, city, aliases, coordinates, updated,
            riskSummary, riskStatus, stats, factors, advisories, universities,
            reports, points, floods, hazards, risk
        );
    }

    private static SafeGoLocation buildEspana() {
        List<RiskFactor> factors = List.of(
            new RiskFactor("Weather",             58, "mod",  "Moderate", "Heavy rain since 4:30 AM, 25°C, gusts up to 45 km/h. PAGASA rainfall advisory in effect.", "weather", "icon-weather"),
            new RiskFactor("Flood / roads",       52, "mod",  "Moderate", "Ankle-deep flooding at 2 points along España Blvd. Vehicles passable at reduced speed.",     "flood",   "icon-mod"),
            new RiskFactor("Official advisories", 70, "high", "Elevated", "1 PAGASA rainfall advisory and 1 city flood bulletin for España / Sampaloc, issued in the last 2 hours.", "alert", "icon-alert"),
            new RiskFactor("School status",       20, "low",  "Normal",   "Mapúa University has not announced a class suspension as of the latest update.",              "school",  "icon-ok"),
            new RiskFactor("Community reports",   40, "mod",  "3 recent", "3 flood reports and 1 stalled vehicle in the past hour, pending verification.",                "reports", "icon-neutral")
        );
        List<Advisory> advisories = List.of(
            new Advisory("weather",   "PAGASA",    "Orange Rainfall Warning for Metro Manila",        "Demo announcement only. Heavy rainfall may cause flooding in low-lying areas within the next three hours. This is not an active PAGASA warning.", "6:15 AM", DEMO_DATE, true),
            new Advisory("school",    "School",    "Mapúa University: classes proceed as scheduled",  "No suspension announced. Monitor road conditions and allot extra travel time.", "6:00 AM", null, null),
            new Advisory("weather",   "Weather",   "Localized flood watch: España / Sampaloc",        "Street-level flooding possible in low-lying sections due to sustained rainfall.", "5:50 AM", null, null),
            new Advisory("community", "Community", "Slow traffic along Quezon Blvd.",                 "Aggregated from 4 reports in the last hour. Pending official verification.", "5:40 AM", null, null)
        );
        List<UniversityStatus> universities = List.of(
            new UniversityStatus("ust-manila",  "University of Santo Tomas", "España, Manila",            "/university-logos/ust.png",  "University of Santo Tomas seal",    "open",      "No demo suspension",       "This example does not include a class suspension for this campus. Check official university announcements before leaving.", DEMO_DATE, "6:00 AM", true,  null, null, null),
            new UniversityStatus("feu-manila",  "Far Eastern University",    "Nicanor Reyes Street, Manila", "/university-logos/feu.webp", "Far Eastern University seal",       "no-update", "No update available",       "SafeGo has no current suspension announcement for this campus. This does not confirm that classes are ongoing.", DEMO_DATE, "5:55 AM", true, null, null, null)
        );
        List<CommunityReport> reports = List.of(
            new CommunityReport("Flooding",             "Ankle-deep flooding",       "España Blvd. corner Morayta · 6:20 AM", "pending",    "Pending"),
            new CommunityReport("Road Hazard",          "Open manhole reported",     "Lerma St. · 5:55 AM",                  "verified",   "Verified"),
            new CommunityReport("Transport Disruption", "Jeepney route rerouted",    "Quezon Blvd. · 5:40 AM",               "unverified", "Unverified")
        );
        return create(
            "espana", "España Blvd., Sampaloc", "Manila",
            List.of("espana", "españa", "sampaloc", "morayta"),
            new double[]{14.612, 120.9902},
            "6:42 AM",
            "Moderate rainfall and localized street flooding. Travel is possible, but expect delays. Allow extra time and monitor advisories before leaving.",
            "Passable, delays likely",
            List.of(
                new Stat("Weather",          "Heavy rain, 25°C",       "Signal No. 1 · Gusts to 45 km/h",        "weather", "icon-weather"),
                new Stat("School status",    "Classes ongoing",         "Mapúa · face-to-face, 6:00 AM",          "school",  "icon-ok"),
                new Stat("Road condition",   "Partial flooding",        "Ankle-deep at 2 spots",                   "flood",   "icon-mod"),
                new Stat("Latest advisory",  "PAGASA rainfall advisory","Issued 6:15 AM · Metro Manila",           "alert",   "icon-alert")
            ),
            factors, advisories, universities, reports,
            List.of(
                new RoutePoint("start", "North of area", "Lacson / España",              "Dry at this end of the road"),
                new RoutePoint("mid",   "Watched",       "España Blvd. (Sampaloc)",       "Ankle-deep flooding at 2 points · reduced speed"),
                new RoutePoint("mid",   "Watched",       "Quezon Blvd. underpass",         "Passable, water rising slowly"),
                new RoutePoint("end",   "South of area", "Toward Quiapo",                 "Low visibility reported near the underpass")
            ),
            List.of(
                new Hazard("España Blvd. near Morayta",  "Ankle-deep (~10cm) · vehicles passable", null),
                new Hazard("Quezon Blvd. underpass",     "Shin-level, rising slowly · monitored by MMDA", "icon-brand")
            ),
            List.of(
                new Hazard("Stalled jeepney, España Blvd.", "Reported 6:20 AM · Pending",    null),
                new Hazard("Open manhole, Lerma St.",       "Reported 5:55 AM · Verified",   null),
                new Hazard("Low visibility, Quiapo underpass", "Reported 6:05 AM · Unverified", null)
            )
        );
    }

    private static SafeGoLocation buildMakati() {
        List<RiskFactor> factors = List.of(
            new RiskFactor("Weather",             20, "low", "Low",    "Rain continuing but lighter over Makati than over España / Sampaloc.",               "weather", "icon-weather"),
            new RiskFactor("Flood / roads",       20, "low", "Low",    "Campus grounds dry. No access issues reported at the gates.",                         "flood",   "icon-ok"),
            new RiskFactor("Official advisories", 20, "low", "Normal", "School notice: face-to-face classes proceed. City flood bulletins apply to affected roads, not campus grounds.", "alert", "icon-ok"),
            new RiskFactor("School status",       20, "low", "Normal", "No schedule change from Mapúa University administration.",                             "school",  "icon-ok"),
            new RiskFactor("Community reports",   20, "low", "Quiet",  "No new campus hazard reports in the last hour.",                                       "reports", "icon-neutral")
        );
        List<Advisory> advisories = List.of(
            new Advisory("school",   "School",      "Mapúa University: classes proceed as scheduled", "Campus is open. Students coming from España should still check road conditions.", "6:00 AM", null, null),
            new Advisory("gov",      "Government",  "PAGASA rainfall advisory: Metro Manila",          "Metro-wide rainfall advisory remains in effect.", "6:15 AM", null, null),
            new Advisory("weather",  "Weather",     "Makati campus: no flood watch",                   "No street-level flooding reported on campus or immediately outside the gates.", "5:55 AM", null, null)
        );
        List<UniversityStatus> universities = List.of(
            new UniversityStatus("mapua-makati-campus", "Mapúa University", "Makati Campus",
                "/university-logos/mapua.webp", "Mapúa University logo",
                "online", "Online on Sep 10",
                "Confirmed past advisory: all Mapúa campuses shifted to online synchronous classes on September 10, 2026 because of prevailing weather conditions.",
                "Sep 10, 2026", "Official post", false,
                "Mapúa University",
                "https://www.facebook.com/share/p/18ViaW1A7k/",
                true)
        );
        List<CommunityReport> reports = List.of(
            new CommunityReport("Road Hazard", "Wet tiles at Main Building steps", "Makati campus · 6:10 AM", "verified", "Verified")
        );
        return create(
            "mapua-makati", "Mapúa University, Makati", "Makati",
            List.of("mapua", "mapúa", "makati", "mapua makati", "campus"),
            new double[]{14.5665, 121.02},
            "6:40 AM",
            "Campus grounds are dry. Some nearby Makati roads have localized flooding, but access to the campus is currently clear.",
            "Passable",
            List.of(
                new Stat("Weather",         "Rain, 25°C",            "Lighter than inland Sampaloc",    "weather", "icon-weather"),
                new Stat("School status",   "Classes ongoing",        "No suspension as of 6:00 AM",     "school",  "icon-ok"),
                new Stat("Road condition",  "Campus access clear",    "No flooding on campus roads",      "flood",   "icon-ok"),
                new Stat("Latest advisory", "Classes proceed",        "Mapúa admin · 6:00 AM",           "alert",   "icon-ok")
            ),
            factors, advisories, universities, reports,
            List.of(
                new RoutePoint("start", "Approach", "Gil Puyat Avenue",              "Passable, light rain"),
                new RoutePoint("end",   "Campus",   "Mapúa University Makati gates", "Dry grounds, normal access")
            ),
            List.of(new Hazard("No active flood points on campus", "Last checked 6:38 AM", "icon-brand")),
            List.of(new Hazard("Wet tiles at Main Building steps", "Reported 6:10 AM · Verified", null))
        );
    }

    private static SafeGoLocation buildQuiapo() {
        List<RiskFactor> factors = List.of(
            new RiskFactor("Weather",             70, "high", "Elevated", "Heavy rain and spray reducing visibility inside the underpass.",                        "weather", "icon-weather"),
            new RiskFactor("Flood / roads",       70, "high", "High",     "Shin-level water. Stalled vehicles reported. Foot traffic not advised.",                "flood",   "icon-alert"),
            new RiskFactor("Official advisories", 70, "high", "Elevated", "City flood bulletin covers this underpass. MMDA monitoring.",                           "alert",   "icon-alert"),
            new RiskFactor("School status",       20, "low",  "Normal",   "Nearby campuses have not suspended classes. This rating is for the roadway, not class status.", "school", "icon-ok"),
            new RiskFactor("Community reports",   70, "high", "Several",  "Multiple stalled-vehicle and flooding reports in the last hour.",                        "reports", "icon-alert")
        );
        List<Advisory> advisories = List.of(
            new Advisory("gov",      "Government", "Flood bulletin: Quiapo underpass",   "Shin-level flooding. Motorists advised to use alternate routes.", "5:50 AM", null, null),
            new Advisory("weather",  "Weather",    "Heavy rain continuing",               "Sustained rainfall over central Manila this morning.", "6:15 AM", null, null),
            new Advisory("community","Community",  "Stalled vehicles in the underpass",   "Several reports since 5:40 AM. Not all verified.", "6:05 AM", null, null)
        );
        List<UniversityStatus> universities = List.of(
            new UniversityStatus("san-sebastian-manila", "San Sebastian College-Recoletos", "C. M. Recto Avenue, Manila",
                "/university-logos/sscr.png", "San Sebastian College-Recoletos seal",
                "online", "Online in this example",
                "This example shows classes using alternative delivery. Confirm the current class arrangement with the college.",
                DEMO_DATE, "6:05 AM", true, null, null, null)
        );
        List<CommunityReport> reports = List.of(
            new CommunityReport("Flooding",             "Shin-level water in underpass", "Quiapo · 6:05 AM",             "verified",   "Verified"),
            new CommunityReport("Transport Disruption", "Stalled UV Express",            "Quiapo underpass · 6:12 AM",   "pending",    "Pending"),
            new CommunityReport("Road Hazard",          "Low visibility",                "Quiapo underpass · 6:05 AM",   "unverified", "Unverified")
        );
        return create(
            "quiapo", "Quiapo underpass", "Manila",
            List.of("quiapo", "underpass", "quezon bridge"),
            new double[]{14.5995, 120.9842},
            "6:35 AM",
            "Shin-level water at the underpass and low visibility. Vehicles may stall. Foot traffic should avoid this segment if possible.",
            "Hazardous, delays",
            List.of(
                new Stat("Weather",         "Heavy rain, 25°C",  "Low visibility in the underpass",          "weather", "icon-weather"),
                new Stat("School status",   "Classes ongoing",    "Does not override road risk here",         "school",  "icon-mod"),
                new Stat("Road condition",  "Shin-level flooding","Rising slowly · MMDA on site",             "flood",   "icon-alert"),
                new Stat("Latest advisory", "Flood bulletin",     "City government · 5:50 AM",                "alert",   "icon-alert")
            ),
            factors, advisories, universities, reports,
            List.of(
                new RoutePoint("start", "Approach", "Quezon Blvd. north",    "Water beginning to pond"),
                new RoutePoint("mid",   "Watched",  "Quiapo underpass",      "Shin-level · stalled vehicles"),
                new RoutePoint("end",   "Exit",     "Toward Lawton",         "Still passable beyond the dip")
            ),
            List.of(new Hazard("Quiapo underpass", "Shin-level, rising slowly · MMDA on site", null)),
            List.of(
                new Hazard("Stalled UV Express",         "Reported 6:12 AM · Pending",    null),
                new Hazard("Low visibility in underpass","Reported 6:05 AM · Unverified", null)
            )
        );
    }

    private static SafeGoLocation buildLerma() {
        List<RiskFactor> factors = List.of(
            new RiskFactor("Weather",             52, "mod", "Moderate", "Heavy rain continuing over Sampaloc.",                             "weather", "icon-weather"),
            new RiskFactor("Flood / roads",       52, "mod", "Moderate", "Standing water plus a verified open manhole.",                     "flood",   "icon-mod"),
            new RiskFactor("Official advisories", 40, "mod", "Moderate", "Covered by the metro rainfall advisory. No street-specific bulletin.", "alert", "icon-mod"),
            new RiskFactor("School status",       20, "low", "Normal",   "No campus closure affecting this street.",                          "school",  "icon-ok"),
            new RiskFactor("Community reports",   40, "mod", "Active",   "Open manhole verified. Additional flood notes nearby.",             "reports", "icon-neutral")
        );
        List<Advisory> advisories = List.of(
            new Advisory("community", "Community",   "Open manhole on Lerma St.",           "Verified report. Marked and being monitored.", "5:55 AM", null, null),
            new Advisory("gov",       "Government",  "PAGASA rainfall advisory: Metro Manila","Moderate to heavy rainfall expected over Metro Manila.", "6:15 AM", null, null)
        );
        List<UniversityStatus> universities = List.of(
            new UniversityStatus("feu-manila",  "Far Eastern University",    "Nicanor Reyes Street, Manila", "/university-logos/feu.webp", "Far Eastern University seal",       "no-update", "No update available",       "SafeGo has no current suspension announcement for this nearby campus. Confirm through FEU's official channel.", DEMO_DATE, "5:55 AM", true, null, null, null),
            new UniversityStatus("ue-manila",   "University of the East",    "C. M. Recto Avenue, Manila",   "/university-logos/ue.png",   "University of the East anniversary logo","open",      "No demo suspension",         "This example does not include a suspension for this campus. Road hazards near Lerma may still affect the trip.", DEMO_DATE, "6:00 AM", true, null, null, null)
        );
        List<CommunityReport> reports = List.of(
            new CommunityReport("Road Hazard", "Open manhole reported",    "Lerma St. · 5:55 AM",       "verified", "Verified"),
            new CommunityReport("Flooding",    "Ankle-deep near España",  "Lerma / España · 6:18 AM",  "pending",  "Pending")
        );
        return create(
            "lerma", "Lerma St., Sampaloc", "Manila",
            List.of("lerma", "sampaloc"),
            new double[]{14.6049, 120.9888},
            "6:38 AM",
            "An open manhole is verified on Lerma. Nearby España flooding may push more water this way. Use caution on foot.",
            "Passable with caution",
            List.of(
                new Stat("Weather",         "Heavy rain, 25°C",        "Same system as España",          "weather", "icon-weather"),
                new Stat("School status",   "Classes ongoing",          "Nearby Mapúa · 6:00 AM",         "school",  "icon-ok"),
                new Stat("Road condition",  "Open manhole",             "Verified · foot traffic caution", "flood",   "icon-mod"),
                new Stat("Latest advisory", "PAGASA rainfall advisory", "Metro Manila · 6:15 AM",         "alert",   "icon-alert")
            ),
            factors, advisories, universities, reports,
            List.of(
                new RoutePoint("start", "Corner", "Lerma / España",      "Water spilling from España"),
                new RoutePoint("end",   "Watched","Lerma St. manhole",   "Verified open manhole · use caution")
            ),
            List.of(new Hazard("Lerma / España corner", "Ankle-deep spillover from España Blvd.", null)),
            List.of(new Hazard("Open manhole, Lerma St.", "Reported 5:55 AM · Verified", null))
        );
    }

    private static SafeGoLocation buildPasig() {
        List<RiskFactor> factors = List.of(
            new RiskFactor("Weather",             44, "mod", "Moderate", "Estimated moderate rain over Ortigas Center with occasional gusts.",                      "weather", "icon-weather"),
            new RiskFactor("Flood / roads",       36, "mod", "Watched",  "Stored demo observations show wet roads and isolated ponding near low-lying intersections.", "flood",   "icon-mod"),
            new RiskFactor("Official advisories", 40, "mod", "Monitor",  "A demo Pasig notice advises commuters to monitor localized flooding and campus updates.",   "alert",   "icon-mod"),
            new RiskFactor("School status",       48, "mod", "Mixed",    "Demo campus records include one suspension and one institution awaiting an update.",         "school",  "icon-mod"),
            new RiskFactor("Community reports",   20, "low", "Limited",  "This Pasig example has no confirmed community hazard report.",                               "reports", "icon-neutral")
        );
        List<Advisory> advisories = List.of(
            new Advisory("gov",    "Pasig City",  "Monitor low-lying roads during continued rainfall",          "Demo announcement only. Check Pasig City DRRMO channels for an active bulletin.", "6:30 AM", null, null),
            new Advisory("school", "University",  "One nearby campus has a demo class-suspension notice",       "See Nearby universities for institution-level status. These entries are demonstration data.", "6:20 AM", null, null)
        );
        List<UniversityStatus> universities = List.of(
            new UniversityStatus("uap-ortigas", "University of Asia and the Pacific", "Ortigas Center",
                "/university-logos/uap.png", "University of Asia and the Pacific crest",
                "suspended", "Classes suspended",
                "Demo announcement: on-campus classes are suspended for the day. Verify through the university's official channels.",
                DEMO_DATE, "6:20 AM", true, null, null, null),
            new UniversityStatus("plp-pasig", "Pamantasan ng Lungsod ng Pasig", "Pasig",
                "/university-logos/plp.png", "Pamantasan ng Lungsod ng Pasig logo",
                "no-update", "No update available",
                "SafeGo has no current suspension announcement for this university. No update does not mean classes are confirmed.",
                DEMO_DATE, "6:15 AM", true, null, null, null)
        );
        return create(
            "ortigas-pasig", "Ortigas Center, Pasig", "Pasig",
            List.of("ortigas", "pasig", "ortigas center", "kapitolyo"),
            new double[]{14.5869, 121.0614},
            "6:45 AM",
            "Rain is affecting parts of Ortigas Center, but this example shows main access roads as passable. Check current city and campus announcements before leaving.",
            "Passable with caution",
            List.of(
                new Stat("Weather",         "Moderate rain, 26°C",  "Gusts to 32 km/h",                             "weather", "icon-weather"),
                new Stat("School status",   "Mixed announcements",   "1 demo suspension · 1 awaiting update",        "school",  "icon-mod"),
                new Stat("Road condition",  "Wet roads",             "Slow movement near low-lying intersections",   "flood",   "icon-mod"),
                new Stat("Latest advisory", "Monitor Pasig updates", "Demo city notice · 6:30 AM",                  "alert",   "icon-mod")
            ),
            factors, advisories, universities, List.of(),
            List.of(
                new RoutePoint("start", "West side", "ADB Avenue",        "Wet pavement · passable in this example"),
                new RoutePoint("mid",   "Watched",   "Julia Vargas Avenue","Slow movement near intersections"),
                new RoutePoint("end",   "East side", "Ortigas Avenue",    "Monitor low-lying sections")
            ),
            List.of(new Hazard("No verified Pasig flood observation connected", "Stored demo conditions only", "icon-neutral")),
            List.of(new Hazard("Slippery roads near Ortigas intersections", "Demo observation · unverified", null))
        );
    }

    private static SafeGoLocation cloneEspana(
            SafeGoLocation espana,
            String id, String name, String city, List<String> aliases, double[] coordinates) {
        return create(
            id, name, city, aliases, coordinates,
            espana.updated(), espana.riskSummary(), espana.riskStatus(),
            espana.stats(), espana.factors(), espana.advisories(),
            espana.universities(), espana.reports(),
            espana.points(), espana.floods(), espana.hazards()
        );
    }
}
