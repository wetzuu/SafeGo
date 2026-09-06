import "server-only";

import { analyzeRisk } from "../safego/risk-model.ts";
import type { RiskFactor, RiskKey, SafeGoLocation } from "../safego/types.ts";
import {
  fetchOpenMeteoWeather,
  type LiveWeatherObservation,
} from "../providers/open-meteo.ts";
import type { DashboardSnapshot, SourceStatus } from "./contracts.ts";
import { getRepository } from "./repository.ts";

function scoreBand(score: number): { key: RiskKey; label: string } {
  if (score <= 29) return { key: "low", label: "Low" };
  if (score <= 59) return { key: "mod", label: "Moderate" };
  if (score <= 79) return { key: "high", label: "High" };
  return { key: "crit", label: "Critical" };
}

function displayTime(isoTime: string) {
  return new Intl.DateTimeFormat("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  }).format(new Date(isoTime));
}

function applyWeather(
  location: SafeGoLocation,
  observation: LiveWeatherObservation,
) {
  const band = scoreBand(observation.score);
  const weatherFactor: RiskFactor = {
    name: "Weather",
    score: observation.score,
    pill: band.key,
    pillText: band.label,
    description: observation.description,
    icon: "weather",
    tone: "icon-weather",
  };
  const factors = location.factors.map((factor) =>
    factor.name === "Weather" ? weatherFactor : factor,
  );
  const summary =
    "Live modeled weather is included in this score. Flood, road, advisory, school, and community signals retain their latest stored SafeGo values.";
  const risk = analyzeRisk(factors, summary, location.riskStatus);
  const stats = location.stats.map((stat) =>
    stat.label === "Weather"
      ? {
          ...stat,
          value: `${observation.condition}, ${Math.round(observation.temperatureCelsius)}°C`,
          detail: `${observation.precipitationMillimeters.toFixed(1)} mm · gusts ${Math.round(observation.windGustKph)} km/h`,
        }
      : stat,
  );

  return {
    ...location,
    updated: displayTime(observation.observedAt),
    riskSummary: summary,
    factors,
    stats,
    risk,
  };
}

function weatherSource(
  status: SourceStatus["status"],
  successAt: string | null,
  errorMessage: string | null,
): SourceStatus {
  return {
    key: "open-meteo",
    name: "Open-Meteo forecast models",
    kind: "weather",
    status,
    lastSuccessAt: successAt,
    lastFailureAt: errorMessage ? new Date().toISOString() : null,
    errorMessage,
  };
}

export async function getDashboardSnapshot(): Promise<{
  backend: "mock" | "database";
  snapshot: DashboardSnapshot;
}> {
  const { backend, repository } = getRepository();
  const [locations, storedSources] = await Promise.all([
    repository.listDashboardLocations(),
    repository.listSourceStatuses(),
  ]);
  const provider = (
    process.env.SAFEGO_WEATHER_PROVIDER || "open-meteo"
  ).toLowerCase();

  if (provider === "disabled") {
    return {
      backend,
      snapshot: {
        locations,
        sources: [
          ...storedSources,
          weatherSource("disabled", null, null),
        ],
        weatherUpdatedAt: null,
      },
    };
  }

  if (provider !== "open-meteo") {
    throw new Error(
      "SAFEGO_WEATHER_PROVIDER must be open-meteo or disabled.",
    );
  }

  try {
    const observations = await fetchOpenMeteoWeather(locations);
    const byLocation = new Map(
      observations.map((observation) => [observation.locationId, observation]),
    );
    const liveLocations = locations.map((location) => {
      const observation = byLocation.get(location.id);
      return observation ? applyWeather(location, observation) : location;
    });
    const successAt = observations[0]?.fetchedAt ?? new Date().toISOString();

    return {
      backend,
      snapshot: {
        locations: liveLocations,
        sources: [
          ...storedSources.filter((source) => source.key !== "open-meteo"),
          weatherSource("active", successAt, null),
        ],
        weatherUpdatedAt: successAt,
      },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown weather provider error.";
    return {
      backend,
      snapshot: {
        locations,
        sources: [
          ...storedSources.filter((source) => source.key !== "open-meteo"),
          weatherSource("degraded", null, message),
        ],
        weatherUpdatedAt: null,
      },
    };
  }
}
