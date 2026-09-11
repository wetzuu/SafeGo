/** Provisional product limits, not empirically validated hazard boundaries. */
export const PILOT = {
  id: "manila-makati-v1",
  name: "Manila–Makati pilot",
  locationIds: ["espana", "lerma", "quiapo", "mapua-makati"] as readonly string[],
  radiusMeters: 850,
  minimumCoveragePercent: 90,
  sampleLengthMeters: 100,
};

export const UNKNOWN_ROUTE_COLOR = "#64748b";

export function isPilotLocation(location: { id: string }) {
  return PILOT.locationIds.includes(location.id);
}
