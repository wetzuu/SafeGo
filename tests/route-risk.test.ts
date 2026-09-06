import assert from "node:assert/strict";
import test from "node:test";
import { analyzeRouteSegments, distanceKm } from "../lib/trips/route-risk.ts";
import { LOCATIONS } from "../lib/safego/locations.ts";

test("distance calculation is zero for the same point", () => {
  assert.equal(distanceKm([14.6, 121], [14.6, 121]), 0);
});

test("route analysis uses existing calculated location risks", () => {
  const espana = LOCATIONS.find((location) => location.id === "espana")!;
  const result = analyzeRouteSegments(
    [espana.coordinates, [14.613, 120.991]],
    LOCATIONS,
  );

  assert.equal(result.segments[0].basisLocationId, "espana");
  assert.equal(result.segments[0].riskScore, espana.risk.percentage);
  assert.equal(result.overallRiskScore, espana.risk.percentage);
});

test("route analysis applies a high-risk floor", () => {
  const locations = LOCATIONS.map((location, index) => ({
    ...location,
    coordinates: [14.6, 121 + index * 0.01] as [number, number],
    risk: { ...location.risk, percentage: index === 1 ? 70 : 20 },
  }));
  const result = analyzeRouteSegments(
    [[14.6, 121], [14.6, 121.01], [14.6, 121.02]],
    locations,
  );

  assert.equal(result.overallRiskScore, 60);
  assert.match(result.safetyRule, /High route floor/);
});
