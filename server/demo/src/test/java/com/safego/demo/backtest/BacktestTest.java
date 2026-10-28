package com.safego.demo.backtest;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class BacktestTest {

    private static final Path ROOT = Path.of("../..").toAbsolutePath().normalize();

    @Test
    void publishedResultsMatchTheCurrentScoring() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        JsonNode published = mapper.readTree(ROOT.resolve("data/backtest/results.json").toFile());
        JsonNode rebuilt = mapper.valueToTree(Backtest.run(ROOT, true));

        assertEquals(published, rebuilt, "The scoring changed: run `npm run backtest -- --offline` and review docs/BACKTEST.md");
        assertEquals(Backtest.markdown(Backtest.run(ROOT, true)), Files.readString(ROOT.resolve("docs/BACKTEST.md")).replace("\r\n", "\n"));
    }

    @Test
    void everyEventHasADatedSource() throws Exception {
        JsonNode events = new ObjectMapper().readTree(ROOT.resolve("data/backtest/events.json").toFile()).path("events");
        assertTrue(events.size() > 0);
        for (JsonNode event : events) {
            assertTrue(event.path("date").asText().matches("\\d{4}-\\d{2}-\\d{2}"), event.toString());
            assertTrue(event.path("source").asText().startsWith("https://"), event.toString());
            assertTrue(event.path("kind").asText().matches("flood|dry"), event.toString());
        }
    }
}
