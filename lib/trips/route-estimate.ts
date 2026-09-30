import { alertsCovering, fetchActiveAlerts, type ActiveAlert } from "../safego/area-alerts.ts";
import { distanceMeters } from "../safego/area-scoring.ts";
import type { RouteEstimate } from "./route-risk.ts";

// Metro Manila with a small margin; SafeGo only has area data here (matches the backend limits).
const BOUNDS = { minLat: 14.3, maxLat: 14.85, minLon: 120.85, maxLon: 121.2 };
const SAMPLE_SPACING_METERS = 1500;
const MAX_SAMPLES = 40;
/** A weather sample only speaks for route points within this distance. */
const MAX_SAMPLE_DISTANCE_METERS = 3000;

export function inMetroManila([lat, lon]: [number, number]) {
  return lat >= BOUNDS.minLat && lat <= BOUNDS.maxLat && lon >= BOUNDS.minLon && lon <= BOUNDS.maxLon;
}

/** Evenly spaced points along the route inside Metro Manila, at most MAX_SAMPLES of them. */
export function sampleRoute(route: Array<[number, number]>) {
  let length = 0;
  for (let i = 1; i < route.length; i++) length += distanceMeters(route[i - 1], route[i]);
  const spacing = Math.max(SAMPLE_SPACING_METERS, length / MAX_SAMPLES);
  const samples: Array<[number, number]> = [];
  let sinceLast = spacing;
  for (let i = 0; i < route.length; i++) {
    if (i > 0) sinceLast += distanceMeters(route[i - 1], route[i]);
    if (sinceLast >= spacing || i === route.length - 1) {
      if (inMetroManila(route[i])) samples.push(route[i]);
      sinceLast = 0;
    }
  }
  return samples.slice(0, MAX_SAMPLES);
}

/**
 * Scores a route point from live data only: the weather at the nearest sample (within 3 km) and the
 * highest PAGASA alert covering the point, whichever is higher. Null outside Metro Manila or when
 * nothing is known, so those sections stay "not enough data".
 */
export function makeRouteEstimate(
  samples: Array<{ coordinates: [number, number]; score: number }>,
  alerts: ActiveAlert[] | null,
): RouteEstimate | null {
  if (!samples.length && !alerts) return null;
  return (point) => {
    if (!inMetroManila(point)) return null;
    let weather: number | null = null;
    let nearest = Infinity;
    for (const sample of samples) {
      const distance = distanceMeters(point, sample.coordinates);
      if (distance < nearest && distance <= MAX_SAMPLE_DISTANCE_METERS) {
        nearest = distance;
        weather = sample.score;
      }
    }
    const advisory = alerts ? alertsCovering(point, alerts).score : null;
    const known = [weather, advisory].filter((score): score is number => score !== null);
    return known.length ? Math.max(...known) : null;
  };
}

interface WeatherEnvelope {
  data?: { readings: Array<{ key: string; score: number }>; source: { status: string } };
}

/** Live weather along the route and the active PAGASA alerts, as a route estimate. Null if neither is available. */
export async function buildRouteEstimate(route: Array<[number, number]>, useAlerts: boolean): Promise<RouteEstimate | null> {
  const points = sampleRoute(route);
  const weatherRequest = points.length
    ? fetch("/api/areas/weather", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        points: points.map((point, index) => ({ key: `route-${index}`, latitude: point[0], longitude: point[1] })),
      }),
      signal: AbortSignal.timeout(20_000),
    })
      .then((response) => response.json() as Promise<WeatherEnvelope>)
      .then((envelope) => {
        if (envelope.data?.source.status !== "active") return [];
        const scores = new Map(envelope.data.readings.map((reading) => [reading.key, reading.score]));
        return points.flatMap((coordinates, index) => {
          const score = scores.get(`route-${index}`);
          return score === undefined ? [] : [{ coordinates, score }];
        });
      })
      .catch(() => [])
    : Promise.resolve([]);
  const alertsRequest = useAlerts ? fetchActiveAlerts().catch(() => null) : Promise.resolve(null);
  const [samples, alerts] = await Promise.all([weatherRequest, alertsRequest]);
  return makeRouteEstimate(samples, alerts);
}
