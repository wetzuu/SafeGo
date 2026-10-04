import { LOCATIONS } from "./locations.ts";
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

/** Geographic anchors only. All seeded conditions, reports, announcements and statuses are removed. */
export const LOCATION_CATALOG: SafeGoLocation[] = LOCATIONS.map((location) => ({
  ...location,
  updated: "Awaiting live update",
  riskSummary: "SafeGo is waiting for current sources.",
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
    ...location.risk,
    key: "low",
    name: "NOT RATED",
    rank: "Not rated",
    percentage: 0,
    rawScore: 0,
    safetyRule: "",
    contributions: [],
    summary: "Not rated: current information has not loaded.",
    status: "Not rated",
    basis: "none",
    countedFactors: [],
  },
}));
