import type {
  FactorName,
  RiskAssessment,
  RiskFactor,
  RiskKey,
} from "./types";

export const RISK_MODEL_VERSION = "1.0.0";

export const RISK_WEIGHTS: Record<FactorName, number> = {
  Weather: 0.25,
  "Flood / roads": 0.4,
  "Official advisories": 0.2,
  "School status": 0.05,
  "Community reports": 0.1,
};

const RISK_BANDS: Array<{
  maximum: number;
  key: RiskKey;
  name: string;
  rank: string;
}> = [
  { maximum: 29, key: "low", name: "LOW RISK", rank: "Level 1 of 4" },
  { maximum: 59, key: "mod", name: "MODERATE RISK", rank: "Level 2 of 4" },
  { maximum: 79, key: "high", name: "HIGH RISK", rank: "Level 3 of 4" },
  { maximum: 100, key: "crit", name: "CRITICAL RISK", rank: "Level 4 of 4" },
];

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
  let percentage = rawScore;
  let safetyRule = "";

  if (floodScore >= 85 && percentage < 80) {
    percentage = 80;
    safetyRule =
      "Critical floor applied because the flood / road score is 85 or higher.";
  } else if (floodScore >= 70 && percentage < 60) {
    percentage = 60;
    safetyRule =
      "High-risk floor applied because the flood / road score is 70 or higher.";
  }

  if (weatherScore >= 85 && advisoryScore >= 70 && percentage < 60) {
    percentage = 60;
    safetyRule =
      "High-risk floor applied because severe weather is supported by an elevated official advisory.";
  }

  percentage = Math.max(0, Math.min(100, percentage));
  const band =
    RISK_BANDS.find((candidate) => percentage <= candidate.maximum) ??
    RISK_BANDS[RISK_BANDS.length - 1];

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
