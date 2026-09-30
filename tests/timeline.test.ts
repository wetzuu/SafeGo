import assert from "node:assert/strict";
import test from "node:test";
import type { ActiveAlert } from "../lib/safego/area-alerts.ts";
import { LOCATIONS } from "../lib/safego/locations.ts";
import {
  alertsAt,
  currentHour,
  locationAt,
  manilaTime,
  weatherAt,
  type AlertsTimeline,
  type HourWeather,
} from "../lib/safego/timeline.ts";

const hour = (time: string, score: number, rainMm = 0, condition = "Partly cloudy"): HourWeather => ({
  time, score, driver: "sky", condition, rainMm, threeHourMm: 0, temperatureCelsius: 28, gustKph: 10, pagasaLevel: null,
});

const hours: HourWeather[] = [
  hour("2026-09-29T14:00", 5),
  hour("2026-09-29T15:00", 80, 2, "Thunderstorm"),
  hour("2026-09-29T16:00", 45, 3, "Rain"),
  hour("2026-09-29T17:00", 5, 1),
];

test("weatherAt picks the latest hour at or before the time, in Manila time", () => {
  const reading = weatherAt(hours, manilaTime("2026-09-29T15:30"));
  assert.equal(reading?.score, 80);
  assert.equal(reading?.condition, "Thunderstorm");
  assert.equal(reading?.nextThreeHoursMm, 4, "what fell afterwards is known for past hours");
  assert.equal(weatherAt(hours, manilaTime("2026-09-29T13:00")), null, "before the timeline starts");
});

const alert = (id: string, severityScore: number): ActiveAlert => ({
  id, event: "General Flood Advisory", headline: id, description: "", severity: "Moderate", severityScore,
  urgency: "Expected", certainty: "Likely", issuedAt: null, expiresAt: "2099-01-01T00:00:00Z", sourceUrl: "https://x/",
  areas: [{ description: "Metro Manila", polygons: [[[14.4, 120.9], [14.4, 121.2], [14.8, 121.2], [14.8, 120.9], [14.4, 120.9]]] }],
});

const timeline: AlertsTimeline = {
  alerts: [alert("gfa", 45)],
  hours: [
    { time: "2026-09-29T06:00:00Z", alertIds: [] },
    { time: "2026-09-29T07:00:00Z", alertIds: ["gfa"] },
    { time: "2026-09-29T08:00:00Z", alertIds: [] },
  ],
};

test("alertsAt returns the alerts in force during that hour", () => {
  assert.deepEqual(alertsAt(timeline, Date.parse("2026-09-29T07:30:00Z"))?.map((item) => item.id), ["gfa"]);
  assert.deepEqual(alertsAt(timeline, Date.parse("2026-09-29T08:10:00Z")), []);
  assert.equal(alertsAt(null, Date.now()), null, "unknown when the timeline is unavailable");
});

test("locationAt rescores a location from that moment's live factors only", () => {
  const location = LOCATIONS[0];
  const weather = weatherAt(hours, manilaTime("2026-09-29T15:00"));
  const past = locationAt(location, weather, { score: 45, alerts: [alert("gfa", 45)] }, "Mon 3 PM");
  assert.equal(past.risk.basis, "partial");
  assert.equal(past.risk.percentage, 80, "the highest known factor: the thunderstorm");
  assert.equal(past.factors.find((factor) => factor.name === "Weather")?.score, 80);
  assert.equal(past.factors.find((factor) => factor.name === "Official advisories")?.score, 45);
  assert.deepEqual(past.risk.countedFactors, ["Weather", "Official advisories"]);
  assert.equal(past.advisories[0].title, "gfa");
});

test("with nothing known for that time the location is not rated", () => {
  assert.equal(locationAt(LOCATIONS[0], null, null, "Mon 3 PM").risk.basis, "none");
});

test("currentHour rounds down to the hour", () => {
  assert.equal(currentHour(Date.parse("2026-09-30T16:47:12Z")), Date.parse("2026-09-30T16:00:00Z"));
});
