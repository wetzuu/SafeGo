/** Provisional product limits, not empirically validated hazard boundaries. */
export const PILOT = {
  id: "ncr-pilot-v1",
  name: "Metro Manila pilot",
  locationIds: [
    "espana",
    "lerma",
    "quiapo",
    "mapua-makati",
    "ortigas-pasig",
    "marikina-riverbanks",
    "malabon-dampalit",
    "navotas-nbbs",
    "valenzuela-malinta",
    "qc-araneta",
    "mandaluyong-maysilo",
    "san-juan-river",
    "paranaque-sucat",
    "pasay-rotonda",
    "taguig-c6",
    "laspinas-zapote",
    "muntinlupa-bayanan",
    "caloocan-monumento",
  ] as readonly string[],
  radiusMeters: 850,
  minimumCoveragePercent: 90,
  sampleLengthMeters: 100,
};

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
