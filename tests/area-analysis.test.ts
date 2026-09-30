import assert from "node:assert/strict";
import test from "node:test";
import { analyzeArea } from "../lib/safego/area-analysis.ts";
import { LOCATIONS } from "../lib/safego/locations.ts";
import { riskBand } from "../lib/safego/risk-model.ts";

const location = LOCATIONS[0];

test("areas covered by a SafeGo location carry that location's full rating", () => {
  const analysis = analyzeArea(location, { score: 90 });
  assert.equal(analysis.kind, "rated");
  assert.equal(analysis.score, location.risk.percentage);
  assert.equal(analysis.source?.id, location.id);
  assert.ok(analysis.factors.every((factor) => factor.source === "location"));
});

test("uncovered areas with live weather get a partial estimate", () => {
  const analysis = analyzeArea(null, { score: 45 });
  assert.equal(analysis.kind, "partial-estimate");
  assert.equal(analysis.score, 45);
  assert.equal(analysis.riskKey, "mod");
  assert.deepEqual(analysis.factors.find((factor) => factor.name === "Weather"), { name: "Weather", score: 45, source: "live-weather" });
});

test("factors without data are null, never zero", () => {
  const analysis = analyzeArea(null, { score: 5 });
  for (const factor of analysis.factors.filter((candidate) => candidate.name !== "Weather")) {
    assert.equal(factor.score, null);
    assert.equal(factor.source, "none");
  }
});

test("areas with neither coverage nor weather stay unrated", () => {
  const analysis = analyzeArea(null, null);
  assert.equal(analysis.kind, "unrated");
  assert.equal(analysis.score, null);
});

test("riskBand matches the model's band thresholds", () => {
  assert.equal(riskBand(29).key, "low");
  assert.equal(riskBand(30).key, "mod");
  assert.equal(riskBand(60).key, "high");
  assert.equal(riskBand(80).key, "crit");
});

test("PAGASA alerts join weather in the partial estimate, taking the higher score", () => {
  const analysis = analyzeArea(null, { score: 5 }, { score: 45 });
  assert.equal(analysis.kind, "partial-estimate");
  assert.equal(analysis.score, 45);
  assert.deepEqual(analysis.factors.find((factor) => factor.name === "Official advisories"), { name: "Official advisories", score: 45, source: "live-alerts" });
  assert.equal(analysis.factors.find((factor) => factor.name === "Flood / roads")?.score, null);
});

test("no active PAGASA alert is a real zero, not missing data", () => {
  const analysis = analyzeArea(null, null, { score: 0 });
  assert.equal(analysis.kind, "partial-estimate");
  assert.equal(analysis.factors.find((factor) => factor.name === "Official advisories")?.score, 0);
});

test("areas near a partially rated location are partial estimates with demo factors marked", async () => {
  const { honestLocation } = await import("../lib/safego/honest-risk.ts");
  const partial = honestLocation(location, new Set(["Weather", "Official advisories"]));
  const analysis = analyzeArea(partial, { score: 5 }, { score: 0 });
  assert.equal(analysis.kind, "partial-estimate");
  assert.equal(analysis.score, Math.max(partial.risk.percentage, 5, 0));
  assert.equal(analysis.factors.find((factor) => factor.name === "Flood / roads")?.source, "demo");
  assert.equal(analysis.factors.find((factor) => factor.name === "Weather")?.source, "location");
});

test("areas near an unrated location fall back to their own live data", async () => {
  const { honestLocation } = await import("../lib/safego/honest-risk.ts");
  const analysis = analyzeArea(honestLocation(location, new Set()), { score: 20 });
  assert.equal(analysis.kind, "partial-estimate");
  assert.equal(analysis.source, null);
  assert.equal(analysis.score, 20);
});
