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
  source: "location" | "live-weather" | "live-alerts" | "none";
}

export interface AreaAnalysis {
  /**
   * rated: covered by a SafeGo location, so it carries that location's full rating.
   * partial-estimate: only live weather and/or PAGASA alerts are known; an estimate, not a rating.
   * unrated: nothing is known.
   */
  kind: "rated" | "partial-estimate" | "unrated";
  score: number | null;
  riskKey: RiskKey | null;
  riskName: string | null;
  source: SafeGoLocation | null;
  factors: AreaFactorReading[];
}

export function analyzeArea(
  source: SafeGoLocation | null,
  weather: { score: number } | null,
  /** Highest active PAGASA alert severity covering the area (0 when none); null when alerts are unavailable. */
  advisory: { score: number } | null = null,
): AreaAnalysis {
  if (source && source.risk.basis === "none") source = null;
  if (source && source.risk.basis === "partial") {
    // The nearby location only has live factors counted, so this area is a partial estimate too.
    const counted = new Set(source.risk.countedFactors ?? []);
    const factors: AreaFactorReading[] = AREA_FACTORS.map((name) => {
      const factor = source!.factors.find((candidate) => candidate.name === name);
      if (!factor) return { name, score: null, source: "none" };
      return counted.has(name)
        ? { name, score: factor.score, source: "location" }
        : { name, score: null, source: "none" };
    });
    const score = Math.max(source.risk.percentage, weather?.score ?? 0, advisory?.score ?? 0);
    const band = riskBand(score);
    return { kind: "partial-estimate", score, riskKey: band.key, riskName: band.name, source, factors };
  }
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
      : name === "Official advisories" && advisory
        ? { name, score: advisory.score, source: "live-alerts" }
        : { name, score: null, source: "none" });

  const known = [weather?.score, advisory?.score].filter((score): score is number => score !== undefined);
  if (!known.length) return { kind: "unrated", score: null, riskKey: null, riskName: null, source: null, factors };

  // Only the live factors are known, so the estimate is the highest of them. It is labelled as an
  // estimate everywhere because it cannot see street flooding, road closures or community reports.
  const score = Math.max(...known);
  const band = riskBand(score);
  return { kind: "partial-estimate", score, riskKey: band.key, riskName: band.name, source: null, factors };
}
