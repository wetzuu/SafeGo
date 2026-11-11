import policyJson from "../../config/risk-policy.json" with { type: "json" };
import type { FactorName, RiskKey } from "./types.ts";

/**
 * SafeGo's risk policy from config/risk-policy.json. The Java API (RiskPolicy.java) reads the same
 * file, so weights, bands, floors and pilot limits are defined once.
 */
export interface RiskPolicy {
  modelVersion: string;
  weights: Record<FactorName, number>;
  bands: Array<{ maximum: number; key: RiskKey; name: string; label: string; rank: string }>;
  floors: { floodRoadHigh: number; floodRoadCritical: number; severeWeather: number; elevatedAdvisory: number };
  pilot: {
    id: string;
    name: string;
    locationIds: readonly string[];
    radiusMeters: number;
    minimumCoveragePercent: number;
    sampleLengthMeters: number;
  };
  calmArea: { factors: FactorName[]; maxFactorScore: number; maxDistanceKm: number };
  routeComparison: {
    /** A route this close to the lowest risk (in points) counts as "as low". */
    nearLowestRiskPoints: number;
    /** A route this much slower than the quickest (in %) still counts as "about as quick". */
    nearQuickestPercent: number;
    /** More than this much slower (in %) is "slower". */
    slowerPercent: number;
    /** This many points above the lowest risk is "higher risk". */
    higherRiskPoints: number;
    /** Routes rated in this band or above are labelled "avoid", however quick. */
    avoidFromBand: RiskKey;
  };
}

export const RISK_POLICY = policyJson as unknown as RiskPolicy;

/** The band a 0–100 score falls in. */
export function policyBand(score: number) {
  const bands = RISK_POLICY.bands;
  return bands.find((band) => score <= band.maximum) ?? bands[bands.length - 1];
}

/** The lowest score in a band, e.g. 60 for "high". */
export function bandMinimum(key: RiskKey) {
  const bands = RISK_POLICY.bands;
  const index = bands.findIndex((band) => band.key === key);
  if (index < 0) throw new Error(`Unknown risk band: ${key}`);
  return index === 0 ? 0 : bands[index - 1].maximum + 1;
}
