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

test("distant routes have unknown segments and no overall score", () => {
  const result = analyzeRouteSegments([[10.3, 123.8], [10.31, 123.81]], LOCATIONS);
  assert.equal(result.overallRiskScore, null);
  assert.equal(result.rawRiskScore, null);
  assert.equal(result.coverage.coveredPercent, 0);
  assert.ok(result.segments.every((segment) => segment.riskScore === null && segment.basisLocationId === null));
});

test("cloned demo locations cannot expand the pilot", () => {
  const result = analyzeRouteSegments([[14.6405, 121.0741], [14.641, 121.075]], LOCATIONS);
  assert.equal(result.coverage.coveredPercent, 0);
});

test("missing pilot data is unknown, not zero risk", () => {
  const result = analyzeRouteSegments([[14.612, 120.9902], [14.613, 120.991]], []);
  assert.equal(result.overallRiskScore, null);
  assert.equal(result.coverage.status, "insufficient");
});

test("road bends are preserved and uncovered distance is measured by length", () => {
  const route: Array<[number, number]> = [[14.612, 120.9902], [14.63, 121.01], [14.6121, 120.9903]];
  const result = analyzeRouteSegments(route, LOCATIONS);
  assert.ok(result.segments.some((segment) => segment.coordinates.some((point) => point[0] === route[1][0] && point[1] === route[1][1])));
  assert.ok(result.coverage.longestUnknownGapMeters > 1000);
  assert.equal(result.overallRiskScore, null);
  assert.ok(Math.abs(result.coverage.totalMeters - result.coverage.coveredMeters - result.coverage.unknownMeters) < 0.001);
});

test("coverage includes no edge extending beyond the pilot radius", () => {
  const result = analyzeRouteSegments([[14.612, 120.9902], [14.63, 120.9902]], LOCATIONS);
  for (const segment of result.segments.filter((part) => part.coverage === "covered")) {
    const basis = LOCATIONS.find((location) => location.id === segment.basisLocationId)!;
    for (const point of segment.coordinates) assert.ok(distanceKm(point, basis.coordinates) * 1000 <= 850);
  }
});

test("duplicate and invalid geometry cannot produce a false low score", () => {
  assert.throws(() => analyzeRouteSegments([[14.6, 121], [14.6, 121]], LOCATIONS), /distinct/);
  assert.throws(() => analyzeRouteSegments([[NaN, 121], [14.6, 121]], LOCATIONS), /valid coordinates/);
});

test("the 90 percent gate uses unrounded coverage and never treats gaps as zero", () => {
  const location = { ...LOCATIONS[0], coordinates: [14.6, 121] as [number, number], risk: { ...LOCATIONS[0].risk, percentage: 70 } };
  const atMeters = (meters: number): [number, number] => [14.6 + meters / 111195, 121];
  const excursion = Array.from({ length: 101 }, (_, index) => atMeters(index * 10));
  const base = [...excursion, ...excursion.slice(0, -1).reverse()];
  const routeWithLoops = (loops: number) => [...base, ...Array.from({ length: loops }, () => [atMeters(100), atMeters(0)]).flat()];
  const below = analyzeRouteSegments(routeWithLoops(5), [location]);
  const above = analyzeRouteSegments(routeWithLoops(10), [location]);
  assert.ok(below.coverage.coveredPercent < 90);
  assert.equal(below.overallRiskScore, null);
  assert.ok(above.coverage.coveredPercent >= 90 && above.coverage.coveredPercent < 100);
  assert.equal(above.overallRiskScore, 70);
  assert.ok(above.segments.some((segment) => segment.riskScore === null));
});

test("continuous unknown sections preserve a visible dashed polyline", () => {
  const result = analyzeRouteSegments([[10.3, 123.8], [10.31, 123.81], [10.32, 123.8]], LOCATIONS);
  assert.equal(result.segments.length, 1);
  assert.ok(result.segments[0].coordinates.length > 3);
});
