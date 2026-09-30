import { riskBand } from "./risk-model.ts";
import type { FactorName, RiskKey, SafeGoLocation } from "./types.ts";

export const AREA_FACTORS: FactorName[] = [
  "Weather",
  "Flood / roads",
  "Official advisories",
  "School status",
  "Community reports",
];

export interface AreaFactorReading {
  name: FactorName;
  /** null means SafeGo has no reading for this area, which is not the same as zero. */
  score: number | null;
  source: "location" | "live-weather" | "none";
}

export interface AreaAnalysis {
  /**
   * rated: covered by a SafeGo location, so it carries that location's full rating.
   * weather-estimate: only live weather is known; a partial estimate, not a rating.
   * unrated: nothing is known.
   */
  kind: "rated" | "weather-estimate" | "unrated";
  score: number | null;
  riskKey: RiskKey | null;
  riskName: string | null;
  source: SafeGoLocation | null;
  factors: AreaFactorReading[];
}

export function analyzeArea(source: SafeGoLocation | null, weather: { score: number } | null): AreaAnalysis {
  if (source) {
    return {
      kind: "rated",
      score: source.risk.percentage,
      riskKey: source.risk.key,
      riskName: source.risk.name,
      source,
      factors: AREA_FACTORS.map((name) => {
        const factor = source.factors.find((candidate) => candidate.name === name);
        return { name, score: factor?.score ?? null, source: factor ? "location" : "none" };
      }),
    };
  }

  const factors: AreaFactorReading[] = AREA_FACTORS.map((name) =>
    name === "Weather" && weather
      ? { name, score: weather.score, source: "live-weather" }
      : { name, score: null, source: "none" });

  if (!weather) return { kind: "unrated", score: null, riskKey: null, riskName: null, source: null, factors };

  // Only weather is known, so the estimate is the weather score itself. It is labelled as an
  // estimate everywhere because it cannot see flooding, road closures or announcements.
  const band = riskBand(weather.score);
  return { kind: "weather-estimate", score: weather.score, riskKey: band.key, riskName: band.name, source: null, factors };
}
