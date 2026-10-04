import assert from "node:assert/strict";
import test from "node:test";
import type { SourceStatus } from "../lib/data/contracts.ts";
import { honestLocation, honestSnapshot, isRated, liveFactorNames } from "../lib/safego/honest-risk.ts";
import { LOCATIONS } from "../lib/safego/locations.ts";
import type { FactorName } from "../lib/safego/types.ts";

const source = (key: string, status: SourceStatus["status"] = "active"): SourceStatus =>
  ({ key, name: key, kind: "test", status, lastSuccessAt: null, lastFailureAt: null, errorMessage: null });

const quiapo = LOCATIONS.find((location) => location.id === "quiapo") ?? LOCATIONS[0];
const factor = (name: FactorName) => quiapo.factors.find((candidate) => candidate.name === name)!.score;

test("live factors follow active sources and the real database", () => {
  assert.deepEqual([...liveFactorNames([source("open-meteo"), source("pagasa-cap")], "local")].sort(), ["Official advisories", "Weather"]);
  assert.equal(liveFactorNames([source("open-meteo", "degraded")], "local").size, 0);
  assert.ok(liveFactorNames([], "database").has("Community reports"));
  assert.ok(liveFactorNames([source("flood-road")], "local").has("Flood / roads"));
});

test("with some live factors the score is the highest live factor, never a demo one", () => {
  const honest = honestLocation(quiapo, new Set<FactorName>(["Weather", "Official advisories"]));
  assert.equal(honest.risk.basis, "partial");
  assert.equal(honest.risk.percentage, Math.max(factor("Weather"), factor("Official advisories")));
  assert.deepEqual(honest.risk.countedFactors, ["Weather", "Official advisories"]);
  assert.equal(honest.risk.safetyRule, "");
  assert.match(honest.risk.summary, /Partial rating from live weather and official alerts only/);
  assert.match(honest.risk.summary, /flood and road conditions/);
  assert.equal(honest.factors.length, quiapo.factors.length, "demo factors stay visible for context");
});

test("with every factor live the model's full rating is unchanged", () => {
  const all = new Set<FactorName>(quiapo.factors.map((candidate) => candidate.name));
  const honest = honestLocation(quiapo, all);
  assert.equal(honest.risk.basis, "full");
  assert.equal(honest.risk.percentage, quiapo.risk.percentage);
  assert.equal(honest.risk.key, quiapo.risk.key);
});

test("with no live factor the location is not rated", () => {
  const honest = honestLocation(quiapo, new Set());
  assert.equal(honest.risk.basis, "none");
  assert.equal(isRated(honest), false);
  assert.equal(honest.risk.name, "NOT RATED");
});

test("honestSnapshot rescores every location from the snapshot's own sources", () => {
  const snapshot = honestSnapshot({ locations: LOCATIONS, sources: [source("open-meteo")], weatherUpdatedAt: null }, "local");
  assert.ok(snapshot.locations.every((location) => location.risk.basis === "partial"));
  assert.ok(snapshot.locations.every((location) =>
    location.risk.percentage === location.factors.find((candidate) => candidate.name === "Weather")!.score));
});

test("routes treat unrated locations as uncovered and need live flood data for a calm estimate", async () => {
  const { analyzeRouteSegments } = await import("../lib/trips/route-risk.ts");
  const espana = LOCATIONS[0];
  const route: Array<[number, number]> = [espana.coordinates, [espana.coordinates[0] + 0.001, espana.coordinates[1]]];

  const unrated = LOCATIONS.map((location) => honestLocation(location, new Set()));
  const none = analyzeRouteSegments(route, unrated);
  assert.equal(none.overallRiskScore, null);
  assert.ok(none.segments.every((segment) => segment.riskScore === null));

  const weatherOnly = LOCATIONS.map((location) => honestLocation(location, new Set<FactorName>(["Weather"])));
  const partial = analyzeRouteSegments(route, weatherOnly);
  assert.equal(partial.segments[0].riskScore, weatherOnly[0].risk.percentage);
  assert.equal(partial.calmEstimate, false, "a calm estimate needs live flood and advisory data");
});

test("dashboard merge preserves local locations omitted by the backend", () => {
  const live = liveFactorNames([source("open-meteo")], "local");
  const backendSubset = LOCATIONS.slice(0, 5);
  const byId = new Map(backendSubset.map((loc) => [loc.id, loc]));

  const merged = [
    ...LOCATIONS.map((loc) => byId.get(loc.id) ?? honestLocation(loc, live)),
    ...backendSubset.filter((loc) => !LOCATIONS.some((c) => c.id === loc.id)),
  ];

  assert.equal(merged.length, LOCATIONS.length);
  assert.ok(merged.every((loc) => loc.id));
  const omitted = merged.find((loc) => !byId.has(loc.id));
  assert.ok(omitted);
  assert.equal(omitted.risk.basis, "partial");
});
