import assert from "node:assert/strict";
import test from "node:test";
import { classifyRoutes, routeHazards, scoredRoute, type ScoredRoute } from "../lib/trips/route-comparison.ts";
import { assessTripRoutes } from "../lib/trips/trip-assessment.ts";
import { LOCATIONS } from "./fixtures/seeded-locations.ts";
import type { ResolvedPlace, TripAnalysis } from "../lib/trips/types.ts";

const route = (routeId: string, minutes: number | null, riskScore: number | null, hazardFactors: string[] = []): ScoredRoute => ({
  routeId,
  summary: `via ${routeId}`,
  durationSeconds: minutes === null ? null : minutes * 60,
  distanceMeters: 10_000,
  riskScore,
  hazardFactors,
});
const tags = (routes: ScoredRoute[]) => Object.fromEntries(classifyRoutes(routes).map((item) => [item.routeId, item.tradeoffLabel.tag]));

test("the classic trade-off: quick but riskier, slow but lowest risk, and a balance in between", () => {
  const result = tags([route("fast", 20, 50), route("slow", 30, 10), route("middle", 22, 25)]);
  assert.deepEqual(result, { fast: "QUICKEST · HIGHER RISK", slow: "LOWEST RISK · SLOWER", middle: "BALANCED" });
});

test("one route that is both quickest and lowest risk is the best balance", () => {
  const classified = classifyRoutes([route("a", 20, 12), route("b", 26, 30)]);
  assert.equal(classified[0].routeId, "a");
  assert.equal(classified[0].tradeoffLabel.tag, "BEST BALANCE");
  assert.equal(classified[0].tradeoffLabel.variant, "optimal");
  assert.match(classified[0].tradeoffLabel.explanation, /Quickest route and the lowest risk of the 2 found/);
  assert.equal(classified[1].tradeoffLabel.tag, "ALTERNATIVE");
  assert.equal(classified[1].deltaSeconds, 6 * 60);
});

test("a near-quickest route close to the lowest risk beats a much slower lowest-risk route", () => {
  const result = tags([route("fast", 20, 40), route("near", 21, 14), route("slow", 35, 10)]);
  assert.equal(result.near, "BEST BALANCE");
  assert.equal(result.slow, "LOWEST RISK · SLOWER");
  assert.equal(result.fast, "QUICKEST · HIGHER RISK");
});

test("routes in the avoid band are labelled avoid however quick, and never compete", () => {
  const classified = classifyRoutes([route("storm", 15, 82, ["Heavy rainfall warning"]), route("calm", 25, 20)]);
  const storm = classified.find((item) => item.routeId === "storm")!;
  assert.equal(storm.tradeoffLabel.tag, "HIGH RISK · AVOID");
  assert.equal(storm.tradeoffLabel.variant, "danger");
  assert.match(storm.tradeoffLabel.explanation, /heavy rainfall warning/);
  assert.equal(classified.at(-1)?.routeId, "storm", "avoid routes sort last");
  assert.equal(classified[0].tradeoffLabel.tag, "LOWEST RISK");
});

test("unrated routes say so and are never compared", () => {
  const result = classifyRoutes([route("gap", 18, null), route("rated", 24, 30)]);
  assert.equal(result.find((item) => item.routeId === "gap")?.tradeoffLabel.tag, "NOT ENOUGH DATA");
  assert.equal(result.find((item) => item.routeId === "gap")?.tradeoffLabel.variant, "unknown");
  assert.equal(result.find((item) => item.routeId === "rated")?.tradeoffLabel.tag, "LOWEST RISK");
});

test("a single route is labelled as the only route found", () => {
  const [only] = classifyRoutes([route("only", 20, 45)]);
  assert.equal(only.tradeoffLabel.tag, "ONLY ROUTE FOUND");
  assert.equal(only.tradeoffLabel.variant, "caution", "a Moderate route is never drawn green");
  assert.equal(only.deltaSeconds, 0);
});

test("identical risk and time: the first route is the best balance, the rest are plain alternatives", () => {
  const classified = classifyRoutes([route("a", 20, 20), route("b", 20, 20), route("c", 20, 20)]);
  assert.deepEqual(classified.map((item) => item.routeId), ["a", "b", "c"]);
  assert.deepEqual(classified.map((item) => item.tradeoffLabel.tag), ["BEST BALANCE", "ALTERNATIVE", "ALTERNATIVE"]);
  assert.match(classified[1].tradeoffLabel.explanation, /no lower risk/);
});

test("without driving times, routes are ranked by risk alone", () => {
  const result = tags([route("a", null, 40), route("b", null, 20)]);
  assert.deepEqual(result, { a: "ALTERNATIVE", b: "LOWEST RISK" });
});

test("empty input and all-unrated input are handled", () => {
  assert.deepEqual(classifyRoutes([]), []);
  assert.deepEqual(Object.values(tags([route("a", 20, null), route("b", 25, null)])), ["NOT ENOUGH DATA", "NOT ENOUGH DATA"]);
});

test("no badge or explanation ever calls a route safe", () => {
  const sets = [
    [route("fast", 20, 50), route("slow", 30, 10), route("middle", 22, 25)],
    [route("a", 20, 5), route("b", 40, 0)],
    [route("only", 20, 0)],
    [route("x", 20, 75), route("y", 24, null)],
  ];
  for (const routes of sets) {
    for (const item of classifyRoutes(routes)) {
      assert.doesNotMatch(`${item.tradeoffLabel.tag} ${item.tradeoffLabel.explanation}`, /\bsafe(st)?\b|optimal/i);
    }
  }
});

test("every alternative from the API is scored like the main route", () => {
  const origin: ResolvedPlace = { label: "España", coordinates: [14.612, 120.9902], source: "preset", matchedLocationId: null, approximate: true };
  const destination: ResolvedPlace = { ...origin, label: "Lerma", coordinates: [14.6049, 120.9888] };
  const snapshot = { locations: LOCATIONS, sources: [], weatherUpdatedAt: null };
  const result = {
    origin, destination, routingSource: "osrm", roadNames: ["España Boulevard"],
    routeCoordinates: [origin.coordinates, destination.coordinates],
    routeId: "route-1", durationSeconds: 600, distanceMeters: 1200,
    alternatives: [{ routeId: "route-2", routeCoordinates: [origin.coordinates, [14.609, 120.989], destination.coordinates], roadNames: ["Lerma Street"], durationSeconds: 720, distanceMeters: 1500 }],
  } as unknown as TripAnalysis;
  const routes = assessTripRoutes(result, snapshot);
  assert.deepEqual(routes.map((trip) => trip.routeId), ["route-1", "route-2"]);
  assert.equal(routes[1].durationSeconds, 720);
  assert.equal(routes[1].origin, origin);
  assert.notEqual(routes[1].overallRiskScore, undefined);
  const scored = routes.map(scoredRoute);
  assert.equal(scored[1].summary, "via Lerma Street");
  assert.equal(classifyRoutes(scored).length, 2);
});

test("a sliver outside SafeGo's data is not reported as 0%", () => {
  const trip = { advisories: [], corridorLocations: [], coverage: { totalMeters: 10_000, unknownMeters: 20 } } as unknown as Parameters<typeof routeHazards>[0];
  assert.deepEqual(routeHazards(trip), []);
  assert.deepEqual(routeHazards({ ...trip, coverage: { totalMeters: 10_000, unknownMeters: 1_500 } } as typeof trip), ["15% outside SafeGo's data"]);
});
