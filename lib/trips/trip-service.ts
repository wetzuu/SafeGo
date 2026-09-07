import "server-only";

import { getDashboardSnapshot } from "../data/dashboard-service.ts";
import { resolvePlace } from "../providers/nominatim.ts";
import { fetchDrivingRoute } from "../providers/osrm.ts";
import { analyzeRouteSegments, distanceKm, routeRiskBand } from "./route-risk.ts";
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
  const corridorLocations = snapshot.locations
    .map((location) => ({
      location,
      distance: Math.min(
        ...route.routeCoordinates.map((coordinate) =>
          distanceKm(coordinate, location.coordinates),
        ),
      ),
    }))
    .filter((item) => item.distance <= 3)
    .sort((first, second) => second.location.risk.percentage - first.location.risk.percentage)
    .map((item) => item.location);
  const coveredLocations = corridorLocations.length
    ? corridorLocations
    : uniqueBy(
        routeRisk.segments.map((segment) =>
          snapshot.locations.find(
            (location) => location.id === segment.basisLocationId,
          )!,
        ),
        (location) => location.id,
      );
  const band = routeRiskBand(routeRisk.overallRiskScore);

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
      coverageNote: `Route colors use the nearest of ${snapshot.locations.length} SafeGo risk points. Coverage is approximate and may be less precise between monitored areas.`,
      generatedAt: new Date().toISOString(),
      routingSource: "osrm",
    },
  };
}
