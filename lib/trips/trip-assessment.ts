import type { DashboardSnapshot } from "../data/contracts.ts";
import type { TripAnalysis } from "./types.ts";
import { analyzeRouteSegments, routeRiskBand, type RouteEstimate } from "./route-risk.ts";
import { PILOT } from "./pilot.ts";

function uniqueBy<T>(items: T[], key: (item: T) => string) {
  return Array.from(new Map(items.map((item) => [key(item), item])).values());
}

// Reuse the resolved route so refreshing conditions never geocodes its labels again.
export function assessTrip(
  route: Pick<TripAnalysis, "origin" | "destination" | "routeCoordinates" | "roadNames" | "routingSource">,
  snapshot: DashboardSnapshot,
  /** Scores route sections away from SafeGo locations from live weather and PAGASA alerts there. */
  estimate?: RouteEstimate | null,
): TripAnalysis {
  const { origin, destination } = route;
  const routeRisk = analyzeRouteSegments(
    route.routeCoordinates,
    snapshot.locations,
    estimate,
  );
  const basisIds = new Set(routeRisk.segments.map((segment) => segment.basisLocationId));
  const coveredLocations = snapshot.locations.filter((location) => basisIds.has(location.id))
    .sort((first, second) => second.risk.percentage - first.risk.percentage);
  const band = routeRisk.overallRiskScore === null
    ? { key: "unknown" as const, name: "INSUFFICIENT COVERAGE" }
    : routeRiskBand(routeRisk.overallRiskScore);

  return {
    origin,
    destination,
    routeCoordinates: route.routeCoordinates,
    roadNames: route.roadNames,
    segments: routeRisk.segments,
    overallRiskScore: routeRisk.overallRiskScore,
    rawRiskScore: routeRisk.rawRiskScore,
    riskKey: band.key,
    riskName: band.name,
    safetyRule: routeRisk.safetyRule,
    corridorLocations: coveredLocations,
    advisories: uniqueBy(
      coveredLocations.flatMap((location) => location.advisories),
      (advisory) => `${advisory.source}-${advisory.title}`,
    ),
    reports: uniqueBy(
      coveredLocations.flatMap((location) => location.reports),
      (report) => `${report.type}-${report.title}-${report.meta}`,
    ),
    hazards: uniqueBy(
      coveredLocations.flatMap((location) => location.hazards),
      (hazard) => `${hazard.title}-${hazard.meta}`,
    ),
    coverageNote: routeRisk.coverage.estimatedMeters
      ? `${Math.round((routeRisk.coverage.estimatedMeters / routeRisk.coverage.totalMeters) * 100)}% of this route has no SafeGo location nearby, so those sections use an area estimate from live weather and PAGASA alerts. Street flooding and road conditions are not checked there.`
      : routeRisk.calmEstimate
      ? `Only ${routeRisk.coverage.coveredPercent}% of this route has location-specific data, but weather, flood/road and official advisory signals are all low across the ${PILOT.name}. This is an area-wide estimate, not a road-by-road rating; check local conditions before travelling.`
      : `${routeRisk.coverage.coveredPercent}% of this route is within the ${PILOT.name} coverage estimate. A rating requires at least ${PILOT.minimumCoveragePercent}% coverage within ${PILOT.radiusMeters} meters of a pilot point. Gray sections have insufficient information; coverage does not establish that the underlying data is current or verified.`,
    generatedAt: new Date().toISOString(),
    routingSource: route.routingSource,
    coverage: routeRisk.coverage,
    sources: snapshot.sources,
  };
}
