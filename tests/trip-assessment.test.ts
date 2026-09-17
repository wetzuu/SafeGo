import assert from "node:assert/strict";
import test from "node:test";
import { assessTrip } from "../lib/trips/trip-assessment.ts";
import { findSavedDemoRoute } from "../lib/trips/demo-route.ts";
import { LOCATIONS } from "../lib/safego/locations.ts";
import type { ResolvedPlace } from "../lib/trips/types.ts";

const origin: ResolvedPlace = { label: "España", coordinates: [14.612, 120.9902], source: "preset", matchedLocationId: null, approximate: true };
const destination: ResolvedPlace = { ...origin, label: "Lerma", coordinates: [14.6049, 120.9888] };
const route = { origin, destination, ...findSavedDemoRoute(origin.coordinates, destination.coordinates)! };

test("refresh updates trip scores and conditions while preserving the resolved route", () => {
  const initial = assessTrip(route, { locations: LOCATIONS, sources: [], weatherUpdatedAt: null });
  const locations = LOCATIONS.map(location => ({ ...location, risk: { ...location.risk, percentage: 95 }, advisories: [], hazards: [], reports: [] }));
  const refreshed = assessTrip(initial, { locations, sources: [], weatherUpdatedAt: null });
  assert.notEqual(initial.overallRiskScore, refreshed.overallRiskScore);
  assert.equal(refreshed.overallRiskScore, 95);
  assert.equal(refreshed.riskKey, "crit");
  assert.deepEqual(refreshed.advisories, []);
  assert.deepEqual(refreshed.hazards, []);
  assert.deepEqual(refreshed.reports, []);
  assert.equal(refreshed.routeCoordinates, initial.routeCoordinates);
  assert.equal(refreshed.origin, initial.origin);
  assert.equal(refreshed.routingSource, "saved-demo");
});

test("refresh removes a trip rating when coverage data disappears", () => {
  const initial = assessTrip(route, { locations: LOCATIONS, sources: [], weatherUpdatedAt: null });
  const refreshed = assessTrip(initial, { locations: [], sources: [], weatherUpdatedAt: null });
  assert.equal(refreshed.overallRiskScore, null);
  assert.equal(refreshed.riskKey, "unknown");
  assert.deepEqual(refreshed.corridorLocations, []);
});
