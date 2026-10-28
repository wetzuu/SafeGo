import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { honestLocation } from "../lib/safego/honest-risk.ts";
import { describeRisk } from "../lib/safego/plain-language.ts";
import { appNow, basisLine, liveWord, setReplay } from "../lib/safego/replay.ts";
import { currentHour, timelineLabel } from "../lib/safego/timeline.ts";
import { LOCATIONS } from "./fixtures/seeded-locations.ts";

const REPLAY = { label: "Habagat flash floods", at: "2026-08-17T12:00", source: "https://example.com/report" };

afterEach(() => setReplay(null));

test("live mode uses the real clock and says live", () => {
  setReplay(null);
  assert.ok(Math.abs(appNow() - Date.now()) < 1000);
  assert.equal(liveWord(), "live");
  assert.equal(basisLine(), "Based on live weather and PAGASA alerts.");
});

test("a replay moves the clock and the rewind slider to the replay moment", () => {
  setReplay(REPLAY);
  assert.equal(appNow(), Date.parse("2026-08-17T12:00:00+08:00"));
  assert.equal(currentHour(), Date.parse("2026-08-17T12:00:00+08:00"));
  assert.match(timelineLabel(appNow()), /Aug 17/);
});

test("a replay never calls its data live and leaves out PAGASA alerts", () => {
  setReplay(REPLAY);
  assert.equal(liveWord(), "recorded");
  assert.equal(basisLine(), "Based on recorded weather.");
  assert.equal(describeRisk({ level: "high", basis: "partial" }).caveat, "Based on recorded weather.");

  const rated = honestLocation(LOCATIONS[0], new Set(["Weather"]));
  assert.equal(rated.risk.summary, "Based on recorded weather.");
});
