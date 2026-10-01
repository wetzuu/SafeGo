import assert from "node:assert/strict";
import test from "node:test";
import { honestLocation } from "../lib/safego/honest-risk.ts";
import { LOCATIONS } from "../lib/safego/locations.ts";
import { describeLocation, describeRisk, scoreWord, weatherPhrase } from "../lib/safego/plain-language.ts";
import type { FactorName, UniversityStatus } from "../lib/safego/types.ts";
import { activeUniversityAlerts, type UniversityAlert } from "../lib/safego/university-alerts.ts";

test("risk messages say what, why and what to do", () => {
  const message = describeRisk({ level: "high", basis: "partial", weather: { score: 80, condition: "Thunderstorm" }, advisory: { score: 0 } });
  assert.equal(message.headline, "High risk");
  assert.equal(message.why, "Severe weather (thunderstorm), and no official alerts.");
  assert.match(message.action, /Delay non-essential trips/);
  assert.match(message.caveat, /Street flooding and road conditions are not checked/);
});

test("unrated places never read as safe", () => {
  const message = describeRisk({ level: "low", basis: "none" });
  assert.equal(message.headline, "Not rated");
  assert.match(message.why, /does not mean safe/);
});

test("scores always come with a word", () => {
  assert.deepEqual([0, 29, 30, 60, 80].map(scoreWord), ["Low", "Low", "Moderate", "High", "Critical"]);
  assert.equal(weatherPhrase(5, "Partly cloudy"), "calm weather (partly cloudy)");
});

test("a location is described from its counted factors only", () => {
  const location = honestLocation(LOCATIONS[0], new Set<FactorName>(["Weather"]));
  const message = describeLocation(location);
  assert.ok(!message.why.includes("alert"), "the advisory factor is demo data here, so it is not mentioned");
  assert.ok(message.caveat.length > 0);
});

const university = (id: string, status: UniversityStatus["status"], date: string, isMock = false): UniversityStatus => ({
  id, name: id, logoPath: "", logoAlt: "", status, statusLabel: status, announcement: "", date, time: "6:00 AM", isMock,
});
const alert = (item: UniversityStatus, proximity = 0): UniversityAlert => ({ university: item, area: "Area", proximity });
const now = Date.parse("2026-10-01T08:00:00+08:00");

test("only active suspensions and online shifts are shown, most urgent and nearest first", () => {
  const alerts = activeUniversityAlerts([
    alert(university("open", "open", "Oct 1, 2026")),
    alert(university("online-far", "online", "Oct 1, 2026"), 2),
    alert(university("suspended", "suspended", "Sep 30, 2026"), 3),
    alert(university("online-near", "online", "Oct 1, 2026"), 1),
    alert(university("no-update", "no-update", "Oct 1, 2026")),
  ], now);
  assert.deepEqual(alerts.map((item) => item.university.id), ["suspended", "online-near", "online-far"]);
});

test("expired and dismissed announcements disappear; nothing is returned when none apply", () => {
  const old = alert(university("old", "online", "Sep 10, 2026"));
  const current = alert(university("current", "suspended", "Oct 1, 2026"));
  assert.deepEqual(activeUniversityAlerts([old], now), []);
  assert.deepEqual(activeUniversityAlerts([current], now, new Set(["current"])), []);
  assert.deepEqual(activeUniversityAlerts([current, current], now).length, 1, "duplicates collapse");
  assert.equal(activeUniversityAlerts([alert(university("demo", "online", "Sep 14, 2026", true))], now).length, 1, "demo entries do not expire");
});
