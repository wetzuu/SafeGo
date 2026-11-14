import { RISK_POLICY } from "../safego/risk-policy.ts";

/** Provisional product limits from config/risk-policy.json, not empirically validated hazard boundaries. */
export const PILOT = RISK_POLICY.pilot;

export const UNKNOWN_ROUTE_COLOR = "#64748b";

export function isPilotLocation(location: { id: string }) {
  return PILOT.locationIds.includes(location.id);
}
