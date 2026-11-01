import type {
  FactorName,
  RiskAssessment,
  RiskFactor,
  RiskKey,
} from "./types";
import { bandMinimum, policyBand, RISK_POLICY } from "./risk-policy.ts";

// Weights, bands and floors come from config/risk-policy.json, shared with the Java API.
export const RISK_MODEL_VERSION = RISK_POLICY.modelVersion;

export const RISK_WEIGHTS: Record<FactorName, number> = RISK_POLICY.weights;

/** The risk band a 0–100 score falls in, e.g. { key: "mod", name: "MODERATE RISK" }. */
export function riskBand(score: number): { key: RiskKey; name: string } {
  const band = policyBand(score);
  return { key: band.key, name: band.name };
}

/** "Low", "Moderate", "High" or "Critical" for a 0–100 score. */
export function bandLabel(score: number) {
  return policyBand(score).label;
}

function factorScore(factors: RiskFactor[], name: FactorName) {
  return factors.find((factor) => factor.name === name)?.score ?? 0;
}

export function analyzeRisk(
  factors: RiskFactor[],
  summary: string,
  status: string,
): RiskAssessment {
  const contributions = factors.map((factor) => ({
    name: factor.name,
    score: factor.score,
    weight: RISK_WEIGHTS[factor.name],
    points: factor.score * RISK_WEIGHTS[factor.name],
  }));

  const rawScore = Math.round(
    contributions.reduce((total, contribution) => total + contribution.points, 0),
  );
  const floodScore = factorScore(factors, "Flood / roads");
  const weatherScore = factorScore(factors, "Weather");
  const advisoryScore = factorScore(factors, "Official advisories");
  const floors = RISK_POLICY.floors;
  const highMinimum = bandMinimum("high");
  const criticalMinimum = bandMinimum("crit");
  let percentage = rawScore;
  let safetyRule = "";

  if (floodScore >= floors.floodRoadCritical && percentage < criticalMinimum) {
    percentage = criticalMinimum;
    safetyRule =
      `Critical floor applied because the flood / road score is ${floors.floodRoadCritical} or higher.`;
  } else if (floodScore >= floors.floodRoadHigh && percentage < highMinimum) {
    percentage = highMinimum;
    safetyRule =
      `High-risk floor applied because the flood / road score is ${floors.floodRoadHigh} or higher.`;
  }

  if (weatherScore >= floors.severeWeather && advisoryScore >= floors.elevatedAdvisory && percentage < highMinimum) {
    percentage = highMinimum;
    safetyRule =
      "High-risk floor applied because severe weather is supported by an elevated official advisory.";
  }

  percentage = Math.max(0, Math.min(100, percentage));
  const band = policyBand(percentage);

  return {
    key: band.key,
    name: band.name,
    rank: band.rank,
    percentage,
    rawScore,
    safetyRule,
    contributions,
    summary,
    status,
    modelVersion: RISK_MODEL_VERSION,
  };
}

export function riskGradient(score: number) {
  const stops = [
    { score: 0, color: "#15803d" },
    { score: 29, color: "#65a30d" },
    { score: 30, color: "#ca8a04" },
    { score: 59, color: "#eab308" },
    { score: 60, color: "#ea580c" },
    { score: 79, color: "#f97316" },
    { score: 80, color: "#dc2626" },
    { score: 100, color: "#991b1b" },
  ];
  const bounded = Math.max(0, Math.min(100, score));
  const upperIndex = stops.findIndex((stop) => bounded <= stop.score);

  if (upperIndex <= 0) return stops[0].color;

  const lower = stops[upperIndex - 1];
  const upper = stops[upperIndex];
  const amount =
    (bounded - lower.score) / Math.max(1, upper.score - lower.score);
  const start = lower.color.match(/\w\w/g)!.map((value) => parseInt(value, 16));
  const end = upper.color.match(/\w\w/g)!.map((value) => parseInt(value, 16));
  const rgb = start.map((value, index) =>
    Math.round(value + (end[index] - value) * amount),
  );

  return `rgb(${rgb.join(", ")})`;
}
