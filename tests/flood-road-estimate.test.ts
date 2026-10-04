import test from "node:test";
import assert from "node:assert/strict";
import { estimateFloodRoadRisk } from "../lib/safego/flood-road-estimate.ts";
import type { AreaWeather } from "../lib/safego/area-weather.ts";

function weather(overrides: Partial<AreaWeather> = {}): AreaWeather {
  return {
    score: 5,
    driver: "sky",
    condition: "Clear",
    temperatureCelsius: 29,
    windGustKph: 8,
    currentRateMmPerHour: 0,
    lastHourMm: 0,
    pastThreeHoursMm: 0,
    pastDayMm: 0,
    nextThreeHoursMm: 0,
    pagasaLevel: null,
    observedAt: "2026-10-04T09:00:00+08:00",
    ...overrides,
  };
}

test("flood and road estimate is unavailable without weather", () => {
  assert.equal(estimateFloodRoadRisk(null), null);
});

test("dry weather stays a low likelihood but retains the road-data caveat", () => {
  const estimate = estimateFloodRoadRisk(weather());
  assert.equal(estimate?.score, 5);
  assert.equal(estimate?.driver, "dry-weather");
  assert.match(estimate?.limitation ?? "", /not confirmed/i);
});

test("accumulated rain raises flood and road likelihood", () => {
  const estimate = estimateFloodRoadRisk(weather({ pastDayMm: 112 }));
  assert.equal(estimate?.score, 70);
  assert.equal(estimate?.driver, "day-rain");
});

test("an official alert can raise the estimate without becoming a road observation", () => {
  const estimate = estimateFloodRoadRisk(weather(), { score: 80, count: 2 });
  assert.equal(estimate?.score, 80);
  assert.equal(estimate?.confidence, "weather-and-advisory");
  assert.equal(estimate?.driver, "official-advisory");
  assert.match(estimate?.limitation ?? "", /closures/i);
});
