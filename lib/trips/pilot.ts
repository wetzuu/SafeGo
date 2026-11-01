import { RISK_POLICY } from "../safego/risk-policy.ts";

/** Provisional product limits from config/risk-policy.json, not empirically validated hazard boundaries. */
export const PILOT = RISK_POLICY.pilot;

export const AREA_DASHBOARD_LOCATION_IDS = [
  "espana",
  "lerma",
  "quiapo",
  "mapua-makati",
  "ortigas-pasig",
] as const;

export const UNKNOWN_ROUTE_COLOR = "#64748b";

export function isPilotLocation(location: { id: string }) {
  return PILOT.locationIds.includes(location.id);
}

export function isAreaDashboardLocation(location: { id: string }) {
  return AREA_DASHBOARD_LOCATION_IDS.includes(
    location.id as (typeof AREA_DASHBOARD_LOCATION_IDS)[number],
  );
}
