import "server-only";

import { findSavedDemoRoute } from "../trips/demo-route.ts";

const DEFAULT_ENDPOINT = "https://router.project-osrm.org";
const ROUTE_CACHE_MS = 10 * 60 * 1000;
const routeCache = new Map<string, {
  expiresAt: number;
  value: {
    routeCoordinates: Array<[number, number]>;
    roadNames: string[];
    routingSource: "osrm";
  };
}>();

interface OsrmRouteResponse {
  code: string;
  message?: string;
  routes?: Array<{
    geometry: {
      type: "LineString";
      coordinates: Array<[number, number]>;
    };
    legs: Array<{
      steps: Array<{ name?: string }>;
    }>;
  }>;
}

export async function fetchDrivingRoute(
  origin: [number, number],
  destination: [number, number],
  options: { preferSavedDemo?: boolean } = {},
) {
  const baseUrl = process.env.SAFEGO_ROUTING_BASE_URL || DEFAULT_ENDPOINT;
  const coordinates = `${origin[1]},${origin[0]};${destination[1]},${destination[0]}`;
  const fallbackEnabled = process.env.SAFEGO_DEMO_ROUTE_FALLBACK !== "false";
  const preferredFallback = fallbackEnabled && options.preferSavedDemo
    ? findSavedDemoRoute(origin, destination)
    : null;
  if (preferredFallback) return preferredFallback;

  const cacheKey = `${baseUrl}:${coordinates}`;
  const cached = routeCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const parameters = new URLSearchParams({
    alternatives: "false",
    steps: "true",
    geometries: "geojson",
    overview: "full",
  });
  try {
    const response = await fetch(
      `${baseUrl}/route/v1/driving/${coordinates}?${parameters}`,
      { cache: "no-store", signal: AbortSignal.timeout(12_000) },
    );
    if (!response.ok) throw new Error(`Routing service returned HTTP ${response.status}.`);

    const payload = (await response.json()) as OsrmRouteResponse;
    const route = payload.routes?.[0];
    if (payload.code !== "Ok" || !route) {
      throw new Error(payload.message || "No drivable route was found.");
    }

    const routeCoordinates = route.geometry.coordinates.map(
      ([longitude, latitude]) => [latitude, longitude] as [number, number],
    );
    if (routeCoordinates.length < 2 || routeCoordinates.some(([latitude, longitude]) =>
      !Number.isFinite(latitude) || !Number.isFinite(longitude))) {
      throw new Error("Routing service returned invalid route geometry.");
    }
    const roadNames = Array.from(
      new Set(
        route.legs.flatMap((leg) =>
          leg.steps.map((step) => step.name?.trim()).filter(Boolean) as string[],
        ),
      ),
    ).slice(0, 8);
    const value = { routeCoordinates, roadNames, routingSource: "osrm" as const };
    routeCache.set(cacheKey, { expiresAt: Date.now() + ROUTE_CACHE_MS, value });
    return value;
  } catch (error) {
    const fallback = fallbackEnabled ? findSavedDemoRoute(origin, destination) : null;
    if (fallback) return fallback;

    throw error;
  }
}
