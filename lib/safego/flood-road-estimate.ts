import { riskBand } from "./risk-model.ts";
import type { AreaWeather } from "./area-weather.ts";
import type { RiskKey } from "./types.ts";

export type FloodRoadEstimateConfidence = "weather-only" | "weather-and-advisory";

export interface FloodRoadEstimate {
  score: number;
  riskKey: RiskKey;
  label: string;
  confidence: FloodRoadEstimateConfidence;
  driver: "rain-now" | "last-hour" | "three-hour-rain" | "day-rain" | "forecast" | "official-advisory" | "dry-weather";
  why: string;
  action: string;
  limitation: string;
}

function steppedScore(value: number, thresholds: Array<[number, number]>) {
  let score = 5;
  for (const [minimum, candidate] of thresholds) {
    if (value >= minimum) score = candidate;
  }
  return score;
}

/**
 * Estimates the chance of rain-related flooding or road disruption from free weather inputs.
 * It deliberately does not claim that a street is flooded, passable, or closed.
 */
export function estimateFloodRoadRisk(
  weather: AreaWeather | null,
  advisory: { score: number; count?: number } | null = null,
): FloodRoadEstimate | null {
  if (!weather) return null;

  const candidates = [
    { driver: "rain-now" as const, score: steppedScore(weather.currentRateMmPerHour, [[0.1, 15], [2.5, 25], [7.5, 45], [15, 65], [30, 85]]) },
    { driver: "last-hour" as const, score: steppedScore(weather.lastHourMm, [[0.5, 15], [5, 30], [7.5, 45], [15, 65], [30, 85]]) },
    { driver: "three-hour-rain" as const, score: steppedScore(weather.pastThreeHoursMm, [[1, 15], [10, 30], [22.5, 45], [45, 65], [65, 90]]) },
    { driver: "day-rain" as const, score: steppedScore(weather.pastDayMm, [[10, 15], [30, 30], [50, 50], [100, 70], [150, 90]]) },
    { driver: "forecast" as const, score: steppedScore(weather.nextThreeHoursMm, [[1, 15], [10, 25], [22.5, 40], [45, 60], [65, 80]]) },
    { driver: "official-advisory" as const, score: advisory?.score ?? 0 },
  ];
  const strongest = candidates.reduce((best, candidate) => candidate.score > best.score ? candidate : best);
  const driver = strongest.score <= 5 ? "dry-weather" : strongest.driver;
  const score = Math.min(100, Math.max(5, strongest.score));
  const band = riskBand(score);

  const reasons: Record<FloodRoadEstimate["driver"], string> = {
    "rain-now": `Rain is falling at ${weather.currentRateMmPerHour.toFixed(1)} mm/h.`,
    "last-hour": `${weather.lastHourMm.toFixed(1)} mm of rain fell in the last hour.`,
    "three-hour-rain": `${weather.pastThreeHoursMm.toFixed(1)} mm of rain fell in the last 3 hours.`,
    "day-rain": `${weather.pastDayMm.toFixed(1)} mm of rain fell in the last 24 hours, so low areas may drain slowly.`,
    forecast: `${weather.nextThreeHoursMm.toFixed(1)} mm of rain is forecast in the next 3 hours.`,
    "official-advisory": `${advisory?.count ?? 1} PAGASA alert${(advisory?.count ?? 1) === 1 ? "" : "s"} cover this area.`,
    "dry-weather": "The weather model shows little recent or expected rain.",
  };

  return {
    score,
    riskKey: band.key,
    label: band.name,
    confidence: advisory && advisory.score > 0 ? "weather-and-advisory" : "weather-only",
    driver,
    why: reasons[driver],
    action: score >= 80
      ? "Avoid low-lying roads and verify passability with local authorities before travelling."
      : score >= 60
        ? "Use major roads, allow extra time, and check for closures before leaving."
        : score >= 30
          ? "Watch for ponding at underpasses and low intersections, especially if rain continues."
          : "Normal travel may be reasonable, but still check the road ahead because local flooding can be missed.",
    limitation: "Weather-based estimate only. SafeGo has not confirmed street flooding, traffic flow, passability, or road closures.",
  };
}
