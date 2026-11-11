import assert from "node:assert/strict";
import test from "node:test";
import { describeLiveEvent, parseLiveEvent, type UniversityAdvisoryEvent } from "../lib/safego/live-events.ts";

const advisory: UniversityAdvisoryEvent = {
  type: "UNIVERSITY_ADVISORY", universityId: "ust-manila", universityName: "University of Santo Tomas (España, Manila)",
  lguCode: "NCR-MANILA", status: "SUSPENDED", scope: "ALL_LEVELS", issuedAt: "2026-11-11T00:00:00Z",
  message: "UST suspends classes", sourceName: "Example News", sourceUrl: "https://news.example/ust",
  verified: false, areaWide: false, origin: "scanner",
};

test("events from the server are parsed by type and anything else is ignored", () => {
  assert.equal(parseLiveEvent("UNIVERSITY_ADVISORY", JSON.stringify(advisory))?.type, "UNIVERSITY_ADVISORY");
  assert.equal(parseLiveEvent("WEATHER_ESCALATED", JSON.stringify({ type: "WEATHER_ESCALATED", from: "CLEAR", to: "LIGHT_RAIN", reason: "x", at: "y" }))?.type, "WEATHER_ESCALATED");
  assert.equal(parseLiveEvent("UNIVERSITY_ADVISORY", "not json"), null);
  assert.equal(parseLiveEvent("WEATHER_ESCALATED", JSON.stringify(advisory)), null, "type and payload must agree");
  assert.equal(parseLiveEvent("SOMETHING_ELSE", "{}"), null);
});

test("notices say plainly when a suspension is only a news report", () => {
  assert.equal(describeLiveEvent(advisory), "University of Santo Tomas (España, Manila): classes suspended for all levels (news report, not yet the school's own notice).");
  assert.equal(describeLiveEvent({ ...advisory, verified: true, status: "ASYNCHRONOUS", scope: "UNSPECIFIED" }), "University of Santo Tomas (España, Manila): classes moved online.");
  assert.match(describeLiveEvent({ type: "WEATHER_ESCALATED", from: "CLEAR", to: "LIGHT_RAIN", reason: "x", at: "y" }), /checking schools/);
});
