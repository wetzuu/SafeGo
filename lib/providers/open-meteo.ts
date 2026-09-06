import "server-only";

import type { SafeGoLocation } from "../safego/types.ts";
import {
  scoreWeatherConditions,
  weatherCodeLabel,
} from "./weather-scoring.ts";

const OPEN_METEO_ENDPOINT = "https://api.open-meteo.com/v1/forecast";

interface OpenMeteoCurrent {
  time: string;
  temperature_2m: number;
  relative_humidity_2m: number;
  precipitation: number;
  rain: number;
  showers: number;
  weather_code: number;
  wind_speed_10m: number;
  wind_gusts_10m: number;
}

interface OpenMeteoResponse {
  current: OpenMeteoCurrent;
}

export interface LiveWeatherObservation {
  locationId: string;
  observedAt: string;
  fetchedAt: string;
  expiresAt: string;
  score: number;
  condition: string;
  temperatureCelsius: number;
  precipitationMillimeters: number;
  windSpeedKph: number;
  windGustKph: number;
  humidityPercent: number;
  description: string;
}

export async function fetchOpenMeteoWeather(
  locations: SafeGoLocation[],
): Promise<LiveWeatherObservation[]> {
  if (!locations.length) return [];

  const parameters = new URLSearchParams({
    latitude: locations.map((location) => location.coordinates[0]).join(","),
    longitude: locations.map((location) => location.coordinates[1]).join(","),
    current:
      "temperature_2m,relative_humidity_2m,precipitation,rain,showers,weather_code,wind_speed_10m,wind_gusts_10m",
    timezone: "Asia/Manila",
  });
  const response = await fetch(`${OPEN_METEO_ENDPOINT}?${parameters}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    throw new Error(`Open-Meteo returned HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as
    | OpenMeteoResponse
    | OpenMeteoResponse[];
  const results = Array.isArray(payload) ? payload : [payload];

  if (results.length !== locations.length) {
    throw new Error("Open-Meteo returned an unexpected number of locations.");
  }

  const fetchedAt = new Date();
  const expiresAt = new Date(fetchedAt.getTime() + 10 * 60 * 1000);

  return results.map((result, index) => {
    const current = result.current;
    if (!current || ![
      current.weather_code,
      current.temperature_2m,
      current.relative_humidity_2m,
      current.precipitation,
      current.wind_speed_10m,
      current.wind_gusts_10m,
    ].every(Number.isFinite)) {
      throw new Error("Open-Meteo response is missing current weather fields.");
    }

    const condition = weatherCodeLabel(current.weather_code);
    const score = scoreWeatherConditions({
      weatherCode: current.weather_code,
      precipitationMillimeters: current.precipitation,
      windGustKph: current.wind_gusts_10m,
    });

    return {
      locationId: locations[index].id,
      observedAt: `${current.time}${current.time.length === 16 ? ":00" : ""}+08:00`,
      fetchedAt: fetchedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      score,
      condition,
      temperatureCelsius: current.temperature_2m,
      precipitationMillimeters: current.precipitation,
      windSpeedKph: current.wind_speed_10m,
      windGustKph: current.wind_gusts_10m,
      humidityPercent: current.relative_humidity_2m,
      description: `${condition}, ${current.precipitation.toFixed(1)} mm precipitation, winds ${Math.round(current.wind_speed_10m)} km/h with gusts to ${Math.round(current.wind_gusts_10m)} km/h. Modeled conditions from Open-Meteo.`,
    };
  });
}
