import assert from "node:assert/strict";
import test from "node:test";
import {
  scoreWeatherConditions,
  weatherCodeLabel,
} from "../lib/providers/weather-scoring.ts";

test("weather scoring stays low in calm and dry conditions", () => {
  assert.equal(
    scoreWeatherConditions({
      weatherCode: 1,
      precipitationMillimeters: 0,
      windGustKph: 12,
    }),
    5,
  );
});

test("heavy hourly precipitation raises weather severity", () => {
  assert.equal(
    scoreWeatherConditions({
      weatherCode: 61,
      precipitationMillimeters: 8,
      windGustKph: 20,
    }),
    70,
  );
});

test("severe thunderstorms remain critical regardless of light modeled rain", () => {
  assert.equal(
    scoreWeatherConditions({
      weatherCode: 99,
      precipitationMillimeters: 1,
      windGustKph: 30,
    }),
    95,
  );
  assert.equal(weatherCodeLabel(99), "Thunderstorm");
});
