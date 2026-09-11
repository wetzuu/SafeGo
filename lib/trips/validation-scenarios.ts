import { LOCATIONS } from "../safego/locations.ts";
import { analyzeRisk } from "../safego/risk-model.ts";
import type { FactorName } from "../safego/types.ts";
import { analyzeRouteSegments, routeRiskBand } from "./route-risk.ts";
import type { TripAnalysis } from "./types.ts";
import { PILOT } from "./pilot.ts";

interface ValidationScenario {
  id: string;
  title: string;
  purpose: string;
  scores: Partial<Record<FactorName, number>>;
  route: Array<[number, number]>;
  expectedBand: TripAnalysis["riskKey"];
  expectedScore: number | null;
}

// Curated synthetic cases, not historical events or independent validation.
// Expected outcomes are product acceptance decisions for reviewers to challenge.
const localRoute: Array<[number, number]> = [[14.612, 120.9902], [14.613, 120.991]];
export const VALIDATION_SCENARIOS: ValidationScenario[] = [
  { id: "calm", title: "Calm covered route", purpose: "A low estimate still must not imply guaranteed safety.", scores: {}, route: localRoute, expectedBand: "low", expectedScore: 20 },
  { id: "severe-flood", title: "Severe flooding despite calm weather", purpose: "Severe road flooding must preserve the High floor.", scores: { Weather: 10, "Flood / roads": 70, "Official advisories": 10, "School status": 0, "Community reports": 0 }, route: localRoute, expectedBand: "high", expectedScore: 60 },
  { id: "critical-flood", title: "Critical road flooding", purpose: "Extreme road conditions must preserve the Critical floor.", scores: { Weather: 10, "Flood / roads": 90, "Official advisories": 10, "School status": 0, "Community reports": 0 }, route: localRoute, expectedBand: "crit", expectedScore: 80 },
  { id: "corroborated-storm", title: "Severe weather with an elevated advisory", purpose: "Corroborated weather must preserve the High floor.", scores: { Weather: 85, "Flood / roads": 10, "Official advisories": 70, "School status": 0, "Community reports": 0 }, route: localRoute, expectedBand: "high", expectedScore: 60 },
  { id: "coverage-gap", title: "Calm points with a long uncovered gap", purpose: "Sparse points cannot yield a reassuring overall score.", scores: {}, route: [[14.612, 120.9902], [14.59, 121.005], [14.5665, 121.02]], expectedBand: "unknown", expectedScore: null },
  { id: "hazard-and-gap", title: "Known critical section and an unknown remainder", purpose: "Retain the critical section while withholding the trip rating.", scores: { "Flood / roads": 90 }, route: [[14.612, 120.9902], [14.59, 121.005], [14.5665, 121.02]], expectedBand: "unknown", expectedScore: null },
  { id: "outside-pilot", title: "Route outside the pilot", purpose: "Unrelated Manila points must not be assigned to a distant route.", scores: {}, route: [[10.3157, 123.8854], [10.32, 123.9]], expectedBand: "unknown", expectedScore: null },
];

export function replayScenario(scenario: ValidationScenario): TripAnalysis {
  const locations = LOCATIONS.filter((location) => PILOT.locationIds.includes(location.id)).map((location) => {
    const factors = location.factors.map((factor) => ({ ...factor, score: scenario.scores[factor.name] ?? 20, description: "Synthetic validation input; not a current observation." }));
    const risk = analyzeRisk(factors, "Synthetic validation scenario.", "Simulation");
    return { ...location, factors, risk, updated: "simulation", riskSummary: risk.summary, hazards: [], floods: [], reports: [], advisories: [] };
  });
  const result = analyzeRouteSegments(scenario.route, locations);
  const basis = new Set(result.segments.map((segment) => segment.basisLocationId));
  const band = result.overallRiskScore === null ? { key: "unknown" as const, name: "INSUFFICIENT COVERAGE" } : routeRiskBand(result.overallRiskScore);
  return {
    ...result,
    origin: { label: "Simulated origin", coordinates: scenario.route[0], source: "preset", matchedLocationId: null, approximate: true },
    destination: { label: "Simulated destination", coordinates: scenario.route.at(-1)!, source: "preset", matchedLocationId: null, approximate: true },
    routeCoordinates: scenario.route,
    roadNames: [], riskKey: band.key, riskName: band.name,
    corridorLocations: locations.filter((location) => basis.has(location.id)),
    advisories: [], hazards: [], reports: [], sources: [],
    coverageNote: "Synthetic route geometry and scores. This is a repeatable product review, not evidence of actual road conditions.",
    generatedAt: "2026-09-11T00:00:00.000Z", routingSource: "simulation",
  };
}
