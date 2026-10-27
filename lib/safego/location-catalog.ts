import { LOCATION_ANCHORS } from "./locations.ts";
import { analyzeRisk } from "./risk-model.ts";
import type { RiskFactor, SafeGoLocation } from "./types.ts";

const EMPTY_FACTORS: RiskFactor[] = [
  ["Weather", "weather", "icon-weather"],
  ["Flood / roads", "flood", "icon-neutral"],
  ["Official advisories", "alert", "icon-neutral"],
  ["School status", "school", "icon-neutral"],
  ["Community reports", "reports", "icon-neutral"],
].map(([name, icon, tone]) => ({
  name: name as RiskFactor["name"],
  score: 0,
  pill: "low",
  pillText: "Unavailable",
  description: "No current source is connected for this factor.",
  icon: icon as RiskFactor["icon"],
  tone: tone as RiskFactor["tone"],
}));

const WAITING = "SafeGo is waiting for current sources.";

/** The places SafeGo rates, before any live data arrives: nothing is rated and nothing is reported. */
export const LOCATION_CATALOG: SafeGoLocation[] = LOCATION_ANCHORS.map((anchor) => ({
  ...anchor,
  updated: "Awaiting live update",
  riskSummary: WAITING,
  riskStatus: "Not rated",
  stats: [],
  factors: EMPTY_FACTORS.map((factor) => ({ ...factor })),
  advisories: [],
  universities: [],
  reports: [],
  points: [],
  floods: [],
  hazards: [],
  risk: {
    ...analyzeRisk(EMPTY_FACTORS, WAITING, "Not rated"),
    name: "NOT RATED",
    rank: "Not rated",
    percentage: 0,
    rawScore: 0,
    safetyRule: "",
    contributions: [],
    summary: "Not rated: current information has not loaded.",
    basis: "none",
    countedFactors: [],
  },
}));
