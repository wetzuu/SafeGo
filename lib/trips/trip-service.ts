import "server-only";

import { getDashboardSnapshot } from "../data/dashboard-service.ts";
import { resolvePlace } from "../providers/nominatim.ts";
import { fetchDrivingRoute } from "../providers/osrm.ts";
import { assessTrip } from "./trip-assessment.ts";
import type { TripAnalysis } from "./types.ts";

export async function analyzeTrip(
  originQuery: string,
  destinationQuery: string,
  options: { preferSavedDemo?: boolean } = {},
): Promise<{ analysis: TripAnalysis; backend: "mock" | "database" }> {
  const { backend, snapshot } = await getDashboardSnapshot();
  const origin = await resolvePlace(originQuery, snapshot.locations);
  const destination = await resolvePlace(destinationQuery, snapshot.locations);
  const route = await fetchDrivingRoute(origin.coordinates, destination.coordinates, options);
  return { backend, analysis: assessTrip({ origin, destination, ...route }, snapshot) };
}
