package com.safego.demo.backtest;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.safego.demo.data.LocationAnchors;
import com.safego.demo.data.RainfallScoring;
import com.safego.demo.model.SafeGoLocation;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

/**
 * Runs SafeGo's live weather scoring on documented Metro Manila flood days and dry days.
 *
 * <p>Each day's weather comes from Open-Meteo's archive of past forecasts at the 18 SafeGo places,
 * the same models the live app reads. Responses are saved under data/backtest/raw so the results can be
 * rebuilt offline. PAGASA alerts are not part of the backtest: no public archive of past CAP alerts exists.
 *
 * <p>Run with {@code npm run backtest}. Writes data/backtest/results.json and docs/BACKTEST.md.
 */
public final class Backtest {

    /** SafeGo's "High" band starts here. */
    public static final int HIGH = 60;

    private static final ObjectMapper MAPPER = new ObjectMapper().enable(SerializationFeature.INDENT_OUTPUT);

    public record Event(String date, String kind, String label, String source) {}

    public record DayResult(
        String date,
        String kind,
        String label,
        String source,
        /** The highest weather score at any SafeGo place, which is what the map would show at worst. */
        int topScore,
        String topBand,
        String topPlace,
        String topDriver,
        double topPeakHourMm,
        double topPeakThreeHoursMm,
        double topDayRainMm,
        /** How many of the SafeGo places reached High or above. */
        int placesHighOrAbove,
        int places,
        /** The strongest PAGASA rainfall threshold any place met; null if none. */
        String pagasaLevel,
        boolean flagged
    ) {}

    public record Summary(int floodDays, int floodDaysFlagged, int dryDays, int dryDaysFlagged) {}

    public record Results(String generatedFrom, String rule, Summary summary, List<DayResult> days) {}

    private Backtest() {}

    public static void main(String[] args) throws Exception {
        Path root = Path.of(args.length > 0 ? args[0] : ".").toAbsolutePath().normalize();
        boolean offline = List.of(args).contains("--offline");
        Results results = run(root, offline);
        Files.writeString(root.resolve("data/backtest/results.json"), MAPPER.writeValueAsString(results) + "\n", StandardCharsets.UTF_8);
        Files.writeString(root.resolve("docs/BACKTEST.md"), markdown(results), StandardCharsets.UTF_8);
        Summary s = results.summary();
        System.out.printf(Locale.ROOT, "Flood days rated High or above: %d of %d. Dry days rated High or above: %d of %d.%n",
            s.floodDaysFlagged(), s.floodDays(), s.dryDaysFlagged(), s.dryDays());
        System.out.println("Wrote data/backtest/results.json and docs/BACKTEST.md");
    }

    /** Scores every event, fetching and saving any day not yet in data/backtest/raw (unless offline). */
    public static Results run(Path root, boolean offline) throws Exception {
        List<Event> events = new ArrayList<>();
        MAPPER.readTree(root.resolve("data/backtest/events.json").toFile()).path("events")
            .forEach(node -> events.add(MAPPER.convertValue(node, Event.class)));
        events.sort(Comparator.comparing(Event::kind).thenComparing(Event::date));

        List<SafeGoLocation> places = LocationAnchors.locations();
        List<DayResult> days = new ArrayList<>();
        for (Event event : events) {
            JsonNode payload = load(root, event.date(), places, offline);
            days.add(score(event, payload, places));
        }

        int floodDays = (int) days.stream().filter(d -> d.kind().equals("flood")).count();
        int floodFlagged = (int) days.stream().filter(d -> d.kind().equals("flood") && d.flagged()).count();
        int dryDays = (int) days.stream().filter(d -> d.kind().equals("dry")).count();
        int dryFlagged = (int) days.stream().filter(d -> d.kind().equals("dry") && d.flagged()).count();
        return new Results(
            "Open-Meteo archived forecasts (historical-forecast-api) at the 18 SafeGo places",
            "A day counts as flagged when any SafeGo place scores High (60) or above.",
            new Summary(floodDays, floodFlagged, dryDays, dryFlagged),
            days
        );
    }

    static DayResult score(Event event, JsonNode payload, List<SafeGoLocation> places) {
        List<JsonNode> results = new ArrayList<>();
        if (payload.isArray()) payload.forEach(results::add);
        else results.add(payload);
        if (results.size() != places.size()) {
            throw new IllegalStateException(event.date() + ": expected " + places.size() + " places, got " + results.size());
        }

        String dayAfter = LocalDate.parse(event.date()).plusDays(1).toString();
        RainfallScoring.DayAssessment top = null;
        String topPlace = null;
        int high = 0;
        String level = null;
        for (int i = 0; i < places.size(); i++) {
            List<RainfallScoring.DayAssessment> scored =
                RainfallScoring.assessPastDays(results.get(i).path("daily"), results.get(i).path("hourly"), dayAfter, 1);
            if (scored.isEmpty() || !scored.get(0).date().equals(event.date())) {
                throw new IllegalStateException(event.date() + ": no scored day for " + places.get(i).id());
            }
            RainfallScoring.DayAssessment day = scored.get(0);
            if (day.score() >= HIGH) high++;
            level = stronger(level, day.pagasaLevel());
            if (top == null || day.score() > top.score()
                || (day.score() == top.score() && day.peakThreeHoursMm() > top.peakThreeHoursMm())) {
                top = day;
                topPlace = places.get(i).name();
            }
        }

        return new DayResult(event.date(), event.kind(), event.label(), event.source(),
            top.score(), band(top.score()), topPlace, top.driver(), top.peakHourMm(), top.peakThreeHoursMm(), top.rainMm(),
            high, places.size(), level, top.score() >= HIGH);
    }

    private static JsonNode load(Path root, String date, List<SafeGoLocation> places, boolean offline) throws Exception {
        Path cached = root.resolve("data/backtest/raw/" + date + ".json");
        if (Files.exists(cached)) return MAPPER.readTree(cached.toFile());
        if (offline) throw new IllegalStateException("No saved weather for " + date + "; run without --offline once.");

        String latitudes = places.stream().map(p -> String.format(Locale.ROOT, "%.4f", p.coordinates()[0])).collect(Collectors.joining(","));
        String longitudes = places.stream().map(p -> String.format(Locale.ROOT, "%.4f", p.coordinates()[1])).collect(Collectors.joining(","));
        String url = "https://historical-forecast-api.open-meteo.com/v1/forecast?latitude=" + latitudes + "&longitude=" + longitudes
            + "&daily=weather_code,precipitation_sum,temperature_2m_max,temperature_2m_min,wind_gusts_10m_max"
            + "&hourly=precipitation&start_date=" + date + "&end_date=" + date + "&timezone=Asia%2FManila";

        HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(20)).build();
        HttpRequest request = HttpRequest.newBuilder(URI.create(url))
            .timeout(Duration.ofSeconds(60))
            .header("User-Agent", "SafeGo/0.1 (backtest)")
            .build();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new IllegalStateException(date + ": Open-Meteo returned HTTP " + response.statusCode() + ": " + response.body());
        }
        JsonNode payload = MAPPER.readTree(response.body());
        Files.createDirectories(cached.getParent());
        Files.writeString(cached, MAPPER.writeValueAsString(payload) + "\n", StandardCharsets.UTF_8);
        return payload;
    }

    private static String stronger(String a, String b) {
        List<String> order = List.of("yellow", "orange", "red");
        if (a == null) return b;
        if (b == null) return a;
        return order.indexOf(b) > order.indexOf(a) ? b : a;
    }

    static String band(int score) {
        return score <= 29 ? "Low" : score <= 59 ? "Moderate" : score <= 79 ? "High" : "Critical";
    }

    private static String driverText(String driver) {
        return switch (driver) {
            case "peak-hour" -> "rain in one hour";
            case "three-hour-total" -> "rain over three hours";
            case "wind" -> "wind gusts";
            default -> "sky conditions";
        };
    }

    static String markdown(Results results) {
        Summary s = results.summary();
        StringBuilder md = new StringBuilder();
        md.append("# SafeGo weather backtest\n\n");
        md.append("Generated by `npm run backtest`. Do not edit by hand; change `data/backtest/events.json` and rerun.\n\n");
        md.append("## Result\n\n");
        md.append(String.format(Locale.ROOT, "- **Flood days rated High or above:** %d of %d\n", s.floodDaysFlagged(), s.floodDays()));
        md.append(String.format(Locale.ROOT, "- **Dry days rated High or above:** %d of %d\n\n", s.dryDaysFlagged(), s.dryDays()));
        long floodByRain = results.days().stream()
            .filter(d -> d.kind().equals("flood") && d.flagged() && List.of("peak-hour", "three-hour-total").contains(d.topDriver()))
            .count();
        long dryModerate = results.days().stream().filter(d -> d.kind().equals("dry") && d.topScore() >= 30).count();
        md.append("## What this shows\n\n");
        md.append(String.format(Locale.ROOT, "- On %d of %d flagged flood days the rain amount alone set the rating. ", floodByRain, s.floodDaysFlagged()));
        md.append("On the others it was the model's weather type (thunderstorm or heavy rain): the model's rain amounts were far below ");
        md.append("what PAGASA's gauges measured, so the weather type is what carries the warning.\n");
        md.append(String.format(Locale.ROOT, "- %d of %d dry days still reached Moderate at their worst hour, mostly from afternoon wind gusts ", dryModerate, s.dryDays()));
        md.append("or a brief shower. Only the High line separates flood days from dry days.\n\n");
        md.append("## Method\n\n");
        md.append("- **Days:** documented Metro Manila flood days (dated reports of flooded or impassable roads, or a state of calamity) ");
        md.append("and dry-season days with heat-index class suspensions. Each day links to its source below.\n");
        md.append("- **Weather:** Open-Meteo's archive of past forecasts at the 18 SafeGo places, the same models the live app reads. ");
        md.append("The raw responses are saved in `data/backtest/raw/`.\n");
        md.append("- **Scoring:** the app's own `RainfallScoring.assessPastDays`, unchanged: the strongest of sky conditions, wind gusts, ");
        md.append("the wettest hour, and more than 65 mm in three hours (PAGASA's red threshold).\n");
        md.append("- **Rule:** ").append(results.rule()).append(" That is the worst rating the map would show that day.\n\n");
        md.append("## Limits\n\n");
        md.append("- **Weather only.** PAGASA alerts are not tested: there is no public archive of past CAP alerts.\n");
        md.append("- **Model rain, not gauges.** Weather models smooth out the heaviest downpours, so the rain amounts here are ");
        md.append("usually lower than PAGASA's rain gauges measured on the same day.\n");
        md.append("- **Small sample.** These are a handful of well-documented days, not a full season. They show whether the scoring ");
        md.append("reacts to real events; they are not an accuracy rate.\n");
        md.append("- **Whole-day view.** Each day is scored at its worst hour; the live app scores the current hour.\n\n");

        for (String kind : List.of("flood", "dry")) {
            md.append(kind.equals("flood") ? "## Flood days\n\n" : "## Dry days\n\n");
            md.append("| Date | What happened | Top rating | Where | Set by | Wettest hour | Wettest 3 h | Places High+ |\n");
            md.append("| --- | --- | --- | --- | --- | --- | --- | --- |\n");
            for (DayResult d : results.days()) {
                if (!d.kind().equals(kind)) continue;
                md.append(String.format(Locale.ROOT, "| %s | [%s](%s) | %s (%d) | %s | %s | %.1f mm | %.1f mm | %d of %d |\n",
                    d.date(), d.label(), d.source(), d.topBand(), d.topScore(), d.topPlace(), driverText(d.topDriver()),
                    d.topPeakHourMm(), d.topPeakThreeHoursMm(), d.placesHighOrAbove(), d.places()));
            }
            md.append("\n");
        }
        return md.toString();
    }
}
