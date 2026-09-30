import assert from "node:assert/strict";
import test from "node:test";
import type { ActiveAlert } from "../lib/safego/area-alerts.ts";
import { LOCATIONS } from "../lib/safego/locations.ts";
import { honestLocation } from "../lib/safego/honest-risk.ts";
import { analyzeRouteSegments } from "../lib/trips/route-risk.ts";
import { inMetroManila, makeRouteEstimate, sampleRoute } from "../lib/trips/route-estimate.ts";
import type { FactorName } from "../lib/safego/types.ts";

// Quezon City (Commonwealth) to Makati: far from most SafeGo locations.
const route: Array<[number, number]> = [[14.6760, 121.0437], [14.6400, 121.0400], [14.6000, 121.0300], [14.5547, 121.0244]];

const alert = (score: number): ActiveAlert => ({
  id: "a", event: "General Flood Advisory", headline: "a", description: "", severity: "Moderate", severityScore: score,
  urgency: "Expected", certainty: "Likely", issuedAt: null, expiresAt: "2099-01-01T00:00:00Z", sourceUrl: "https://x/",
  areas: [{ description: "Metro Manila", polygons: [[[14.4, 120.9], [14.4, 121.2], [14.8, 121.2], [14.8, 120.9], [14.4, 120.9]]] }],
});

test("sampleRoute spaces points along the route and keeps only Metro Manila", () => {
  const samples = sampleRoute(route);
  assert.ok(samples.length >= 3 && samples.length <= 40);
  assert.deepEqual(samples.at(-1), route.at(-1));
  assert.equal(sampleRoute([[10.3, 123.9], [10.31, 123.91]]).length, 0, "Cebu has no area data");
});

test("the estimate takes the higher of nearby weather and a covering PAGASA alert", () => {
  const estimate = makeRouteEstimate([{ coordinates: [14.64, 121.04], score: 10 }], [alert(45)])!;
  assert.equal(estimate([14.641, 121.041]), 45);
  const weatherOnly = makeRouteEstimate([{ coordinates: [14.64, 121.04], score: 10 }], null)!;
  assert.equal(weatherOnly([14.641, 121.041]), 10);
  assert.equal(weatherOnly([14.70, 121.20]), null, "no weather sample within 3 km");
  assert.equal(weatherOnly([10.3, 123.9]), null, "outside Metro Manila");
  assert.equal(inMetroManila([14.6, 121.0]), true);
});

test("a cross-city trip is rated with estimated sections instead of insufficient coverage", () => {
  const locations = LOCATIONS.map((location) => honestLocation(location, new Set<FactorName>(["Weather", "Official advisories"])));
  const without = analyzeRouteSegments(route, locations);
  assert.equal(without.coverage.status, "insufficient", "the old behaviour for this route");

  const estimate = makeRouteEstimate(sampleRoute(route).map((coordinates) => ({ coordinates, score: 20 })), [alert(0)]);
  const withEstimate = analyzeRouteSegments(route, locations, estimate);
  assert.equal(withEstimate.coverage.status, "sufficient");
  assert.ok((withEstimate.coverage.estimatedMeters ?? 0) > 0);
  assert.ok(withEstimate.segments.some((segment) => segment.coverage === "estimated"));
  assert.notEqual(withEstimate.overallRiskScore, null);
});
