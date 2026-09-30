import { areaCenter, type AreaCollection, type AreaProperties } from "./area-scoring.ts";

const CACHE_MS = 10 * 60 * 1000;

/** One reading from SafeGo's /api/areas/weather, scored by the backend from Open-Meteo data. */
export interface AreaWeather {
  score: number;
  /** What set the score: sky, current-rain, wind, past-hour, three-hour-total or forecast. */
  driver: "sky" | "current-rain" | "wind" | "past-hour" | "three-hour-total" | "forecast";
  condition: string;
  temperatureCelsius: number;
  windGustKph: number;
  currentRateMmPerHour: number;
  lastHourMm: number;
  pastThreeHoursMm: number;
  pastDayMm: number;
  nextThreeHoursMm: number;
  /** The PAGASA rainfall threshold observed rain meets (a model estimate, not an official warning). */
  pagasaLevel: "yellow" | "orange" | "red" | null;
  observedAt: string;
}

export interface WeatherSamplePoint {
  key: string;
  label: string;
  coordinates: [number, number];
}

/**
 * Forecast models resolve weather at roughly city scale, so areas share one sample per city
 * (per district in Manila, whose districts are already city-sized). This keeps it to one request.
 */
export function weatherGroupKey({ name, city, level }: AreaProperties) {
  return level === "district" ? `${city}: ${name}` : city;
}

export function weatherSamplePoints(collection: AreaCollection): WeatherSamplePoint[] {
  const groups = new Map<string, { label: string; lat: number; lon: number; count: number }>();
  for (const feature of collection.features) {
    const key = weatherGroupKey(feature.properties);
    const [lat, lon] = areaCenter(feature.geometry);
    const group = groups.get(key) ?? {
      label: feature.properties.level === "district" ? `${feature.properties.name}, Manila` : feature.properties.city,
      lat: 0,
      lon: 0,
      count: 0,
    };
    group.lat += lat;
    group.lon += lon;
    group.count += 1;
    groups.set(key, group);
  }
  return [...groups].map(([key, group]) => ({
    key,
    label: group.label,
    coordinates: [group.lat / group.count, group.lon / group.count],
  }));
}

interface AreaWeatherEnvelope {
  data?: { readings: Array<AreaWeather & { key: string }>; source: { status: string; errorMessage: string | null } };
  error?: { message?: string };
}

let cached: { expiresAt: number; value: Map<string, AreaWeather> } | null = null;

/** Live weather per sample point from SafeGo's API, keyed by weatherGroupKey. Cached for ten minutes. */
export async function fetchAreaWeather(points: WeatherSamplePoint[]): Promise<Map<string, AreaWeather>> {
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const response = await fetch("/api/areas/weather", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      points: points.map((point) => ({ key: point.key, latitude: point.coordinates[0], longitude: point.coordinates[1] })),
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const envelope = (await response.json().catch(() => null)) as AreaWeatherEnvelope | null;
  if (!response.ok || !envelope?.data) throw new Error(envelope?.error?.message ?? `Area weather returned HTTP ${response.status}.`);
  if (envelope.data.source.status !== "active") {
    throw new Error(envelope.data.source.errorMessage ?? `Weather source is ${envelope.data.source.status}.`);
  }

  const value = new Map(envelope.data.readings.map(({ key, ...reading }) => [key, reading]));
  cached = { expiresAt: Date.now() + CACHE_MS, value };
  return value;
}
