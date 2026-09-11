import "server-only";

import { getDashboardSnapshot } from "../data/dashboard-service.ts";
import { resolvePlace } from "../providers/nominatim.ts";
import { fetchDrivingRoute } from "../providers/osrm.ts";
import { analyzeRouteSegments, routeRiskBand } from "./route-risk.ts";
import { PILOT } from "./pilot.ts";
import type { TripAnalysis } from "./types.ts";

function uniqueBy<T>(items: T[], key: (item: T) => string) {
  return Array.from(new Map(items.map((item) => [key(item), item])).values());
}

export async function analyzeTrip(
  originQuery: string,
  destinationQuery: string,
): Promise<{ analysis: TripAnalysis; backend: "mock" | "database" }> {
  const { backend, snapshot } = await getDashboardSnapshot();
  const origin = await resolvePlace(originQuery, snapshot.locations);
  const destination = await resolvePlace(destinationQuery, snapshot.locations);
  const route = await fetchDrivingRoute(origin.coordinates, destination.coordinates);
  const routeRisk = analyzeRouteSegments(
    route.routeCoordinates,
    snapshot.locations,
  );
  const basisIds = new Set(routeRisk.segments.map((segment) => segment.basisLocationId));
  const coveredLocations = snapshot.locations.filter((location) => basisIds.has(location.id))
    .sort((first, second) => second.risk.percentage - first.risk.percentage);
  const band = routeRisk.overallRiskScore === null
    ? { key: "unknown" as const, name: "INSUFFICIENT COVERAGE" }
    : routeRiskBand(routeRisk.overallRiskScore);

  return {
    backend,
    analysis: {
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
      coverageNote: `${routeRisk.coverage.coveredPercent}% of this route is within the ${PILOT.name} coverage estimate. A rating requires at least ${PILOT.minimumCoveragePercent}% coverage within ${PILOT.radiusMeters} meters of a pilot point. Gray sections have insufficient information; coverage does not establish that the underlying data is current or verified.`,
      generatedAt: new Date().toISOString(),
      routingSource: "osrm",
      coverage: routeRisk.coverage,
      sources: snapshot.sources,
    },
  };
}
