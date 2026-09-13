import assert from "node:assert/strict";
import test from "node:test";
import { findSavedDemoRoute } from "../lib/trips/demo-route.ts";
import { analyzeRouteSegments } from "../lib/trips/route-risk.ts";
import { LOCATIONS } from "../lib/safego/locations.ts";

const ESPANA: [number, number] = [14.612, 120.9902];
const LERMA: [number, number] = [14.6049, 120.9888];

test("saved demo route is limited to the documented example", () => {
  assert.ok(findSavedDemoRoute(ESPANA, LERMA));
  assert.equal(findSavedDemoRoute(ESPANA, [14.5665, 121.02]), null);
});

test("saved demo route supports both directions and remains within pilot coverage", () => {
  const forward = findSavedDemoRoute(ESPANA, LERMA)!;
  const reverse = findSavedDemoRoute(LERMA, ESPANA)!;
  assert.deepEqual(reverse.routeCoordinates, forward.routeCoordinates.slice().reverse());
  assert.equal(forward.routingSource, "saved-demo");
  assert.equal(analyzeRouteSegments(forward.routeCoordinates, LOCATIONS).coverage.status, "sufficient");
});
