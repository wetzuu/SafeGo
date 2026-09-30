import { scoreWeatherConditions, weatherCodeLabel } from "../providers/weather-scoring.ts";
import { areaCenter, type AreaCollection, type AreaProperties } from "./area-scoring.ts";

const OPEN_METEO_ENDPOINT = "https://api.open-meteo.com/v1/forecast";
const CACHE_MS = 10 * 60 * 1000;

export interface AreaWeather {
  score: number;
  condition: string;
  temperatureCelsius: number;
  precipitationMillimeters: number;
  windGustKph: number;
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

interface OpenMeteoCurrent {
  time: string;
  temperature_2m: number;
  precipitation: number;
  weather_code: number;
  wind_gusts_10m: number;
}

let cached: { expiresAt: number; value: Map<string, AreaWeather> } | null = null;

/** Current modelled weather per sample point, keyed by weatherGroupKey. Cached for ten minutes. */
export async function fetchAreaWeather(points: WeatherSamplePoint[]): Promise<Map<string, AreaWeather>> {
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const parameters = new URLSearchParams({
    latitude: points.map((point) => point.coordinates[0].toFixed(4)).join(","),
    longitude: points.map((point) => point.coordinates[1].toFixed(4)).join(","),
    current: "temperature_2m,precipitation,weather_code,wind_gusts_10m",
    timezone: "Asia/Manila",
  });
  const response = await fetch(`${OPEN_METEO_ENDPOINT}?${parameters}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Open-Meteo returned HTTP ${response.status}.`);
  const payload = (await response.json()) as { current: OpenMeteoCurrent } | Array<{ current: OpenMeteoCurrent }>;
  const results = Array.isArray(payload) ? payload : [payload];
  if (results.length !== points.length) throw new Error("Open-Meteo returned an unexpected number of points.");

  const value = new Map<string, AreaWeather>();
  results.forEach(({ current }, index) => {
    if (!current || ![current.weather_code, current.temperature_2m, current.precipitation, current.wind_gusts_10m].every(Number.isFinite)) return;
    value.set(points[index].key, {
      score: scoreWeatherConditions({
        weatherCode: current.weather_code,
        precipitationMillimeters: current.precipitation,
        windGustKph: current.wind_gusts_10m,
      }),
      condition: weatherCodeLabel(current.weather_code),
      temperatureCelsius: current.temperature_2m,
      precipitationMillimeters: current.precipitation,
      windGustKph: current.wind_gusts_10m,
      observedAt: `${current.time}${current.time.length === 16 ? ":00" : ""}+08:00`,
    });
  });
  cached = { expiresAt: Date.now() + CACHE_MS, value };
  return value;
}
