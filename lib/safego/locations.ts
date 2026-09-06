import { analyzeRisk } from "./risk-model.ts";
import type { LocationInput, SafeGoLocation } from "./types";

function createLocation(input: LocationInput): SafeGoLocation {
  return {
    ...input,
    risk: analyzeRisk(input.factors, input.riskSummary, input.riskStatus),
  };
}

const espanaInput: LocationInput = {
  id: "espana",
  name: "España Blvd., Sampaloc",
  city: "Manila",
  aliases: ["espana", "españa", "sampaloc", "morayta"],
  coordinates: [14.612, 120.9902],
  updated: "6:42 AM",
  riskSummary:
    "Moderate rainfall and localized street flooding. Travel is possible, but expect delays. Allow extra time and monitor advisories before leaving.",
  riskStatus: "Passable, delays likely",
  stats: [
    { label: "Weather", value: "Heavy rain, 25°C", detail: "Signal No. 1 · Gusts to 45 km/h", icon: "weather", tone: "icon-weather" },
    { label: "School status", value: "Classes ongoing", detail: "Mapúa · face-to-face, 6:00 AM", icon: "school", tone: "icon-ok" },
    { label: "Road condition", value: "Partial flooding", detail: "Ankle-deep at 2 spots", icon: "flood", tone: "icon-mod" },
    { label: "Latest advisory", value: "PAGASA rainfall advisory", detail: "Issued 6:15 AM · Metro Manila", icon: "alert", tone: "icon-alert" },
  ],
  factors: [
    { name: "Weather", score: 58, pill: "mod", pillText: "Moderate", description: "Heavy rain since 4:30 AM, 25°C, gusts up to 45 km/h. PAGASA rainfall advisory in effect.", icon: "weather", tone: "icon-weather" },
    { name: "Flood / roads", score: 52, pill: "mod", pillText: "Moderate", description: "Ankle-deep flooding at 2 points along España Blvd. Vehicles passable at reduced speed.", icon: "flood", tone: "icon-mod" },
    { name: "Official advisories", score: 70, pill: "high", pillText: "Elevated", description: "1 PAGASA rainfall advisory and 1 city flood bulletin for España / Sampaloc, issued in the last 2 hours.", icon: "alert", tone: "icon-alert" },
    { name: "School status", score: 20, pill: "low", pillText: "Normal", description: "Mapúa University has not announced a class suspension as of the latest update.", icon: "school", tone: "icon-ok" },
    { name: "Community reports", score: 40, pill: "mod", pillText: "3 recent", description: "3 flood reports and 1 stalled vehicle in the past hour, pending verification.", icon: "reports", tone: "icon-neutral" },
  ],
  advisories: [
    { source: "gov", label: "Government", title: "PAGASA rainfall advisory: Metro Manila", description: "Moderate to heavy rainfall expected over Metro Manila within the next 3 hours.", time: "6:15 AM" },
    { source: "school", label: "School", title: "Mapúa University: classes proceed as scheduled", description: "No suspension announced. Monitor road conditions and allot extra travel time.", time: "6:00 AM" },
    { source: "weather", label: "Weather", title: "Localized flood watch: España / Sampaloc", description: "Street-level flooding possible in low-lying sections due to sustained rainfall.", time: "5:50 AM" },
    { source: "community", label: "Community", title: "Slow traffic along Quezon Blvd.", description: "Aggregated from 4 reports in the last hour. Pending official verification.", time: "5:40 AM" },
  ],
  reports: [
    { type: "Flooding", title: "Ankle-deep flooding", meta: "España Blvd. corner Morayta · 6:20 AM", status: "pending", statusLabel: "Pending" },
    { type: "Road Hazard", title: "Open manhole reported", meta: "Lerma St. · 5:55 AM", status: "verified", statusLabel: "Verified" },
    { type: "Transport Disruption", title: "Jeepney route rerouted", meta: "Quezon Blvd. · 5:40 AM", status: "unverified", statusLabel: "Unverified" },
  ],
  points: [
    { kind: "start", label: "North of area", name: "Lacson / España", detail: "Dry at this end of the corridor" },
    { kind: "mid", label: "Watched", name: "España Blvd. (Sampaloc)", detail: "Ankle-deep flooding at 2 points · reduced speed" },
    { kind: "mid", label: "Watched", name: "Quezon Blvd. underpass", detail: "Passable, water rising slowly" },
    { kind: "end", label: "South of area", name: "Toward Quiapo", detail: "Low visibility reported near the underpass" },
  ],
  floods: [
    { title: "España Blvd. near Morayta", meta: "Ankle-deep (~10cm) · vehicles passable" },
    { title: "Quezon Blvd. underpass", meta: "Shin-level, rising slowly · monitored by MMDA", tone: "icon-brand" },
  ],
  hazards: [
    { title: "Stalled jeepney, España Blvd.", meta: "Reported 6:20 AM · Pending" },
    { title: "Open manhole, Lerma St.", meta: "Reported 5:55 AM · Verified" },
    { title: "Low visibility, Quiapo underpass", meta: "Reported 6:05 AM · Unverified" },
  ],
};

const makatiInput: LocationInput = {
  id: "mapua-makati",
  name: "Mapúa University, Makati",
  city: "Makati",
  aliases: ["mapua", "mapúa", "makati", "mapua makati", "campus"],
  coordinates: [14.5665, 121.02],
  updated: "6:40 AM",
  riskSummary: "Campus grounds are dry. Nearby Makati corridors have localized flooding, but access to the campus is currently clear.",
  riskStatus: "Passable",
  stats: [
    { label: "Weather", value: "Rain, 25°C", detail: "Lighter than inland Sampaloc", icon: "weather", tone: "icon-weather" },
    { label: "School status", value: "Classes ongoing", detail: "No suspension as of 6:00 AM", icon: "school", tone: "icon-ok" },
    { label: "Road condition", value: "Campus access clear", detail: "No flooding on campus roads", icon: "flood", tone: "icon-ok" },
    { label: "Latest advisory", value: "Classes proceed", detail: "Mapúa admin · 6:00 AM", icon: "alert", tone: "icon-ok" },
  ],
  factors: [
    { name: "Weather", score: 20, pill: "low", pillText: "Low", description: "Rain continuing but lighter over Makati than over España / Sampaloc.", icon: "weather", tone: "icon-weather" },
    { name: "Flood / roads", score: 20, pill: "low", pillText: "Low", description: "Campus grounds dry. No access issues reported at the gates.", icon: "flood", tone: "icon-ok" },
    { name: "Official advisories", score: 20, pill: "low", pillText: "Normal", description: "School notice: face-to-face classes proceed. City flood bulletins apply to affected roads, not campus grounds.", icon: "alert", tone: "icon-ok" },
    { name: "School status", score: 20, pill: "low", pillText: "Normal", description: "No schedule change from Mapúa University administration.", icon: "school", tone: "icon-ok" },
    { name: "Community reports", score: 20, pill: "low", pillText: "Quiet", description: "No new campus hazard reports in the last hour.", icon: "reports", tone: "icon-neutral" },
  ],
  advisories: [
    { source: "school", label: "School", title: "Mapúa University: classes proceed as scheduled", description: "Campus is open. Students coming from España should still check road conditions.", time: "6:00 AM" },
    { source: "gov", label: "Government", title: "PAGASA rainfall advisory: Metro Manila", description: "Metro-wide rainfall advisory remains in effect.", time: "6:15 AM" },
    { source: "weather", label: "Weather", title: "Makati campus: no flood watch", description: "No street-level flooding reported on campus or immediately outside the gates.", time: "5:55 AM" },
  ],
  reports: [
    { type: "Road Hazard", title: "Wet tiles at Main Building steps", meta: "Makati campus · 6:10 AM", status: "verified", statusLabel: "Verified" },
  ],
  points: [
    { kind: "start", label: "Approach", name: "Gil Puyat Avenue", detail: "Passable, light rain" },
    { kind: "end", label: "Campus", name: "Mapúa University Makati gates", detail: "Dry grounds, normal access" },
  ],
  floods: [{ title: "No active flood points on campus", meta: "Last checked 6:38 AM", tone: "icon-brand" }],
  hazards: [{ title: "Wet tiles at Main Building steps", meta: "Reported 6:10 AM · Verified" }],
};

const quiapoInput: LocationInput = {
  id: "quiapo",
  name: "Quiapo underpass",
  city: "Manila",
  aliases: ["quiapo", "underpass", "quezon bridge"],
  coordinates: [14.5995, 120.9842],
  updated: "6:35 AM",
  riskSummary: "Shin-level water at the underpass and low visibility. Vehicles may stall. Foot traffic should avoid this segment if possible.",
  riskStatus: "Hazardous, delays",
  stats: [
    { label: "Weather", value: "Heavy rain, 25°C", detail: "Low visibility in the underpass", icon: "weather", tone: "icon-weather" },
    { label: "School status", value: "Classes ongoing", detail: "Does not override road risk here", icon: "school", tone: "icon-mod" },
    { label: "Road condition", value: "Shin-level flooding", detail: "Rising slowly · MMDA on site", icon: "flood", tone: "icon-alert" },
    { label: "Latest advisory", value: "Flood bulletin", detail: "City government · 5:50 AM", icon: "alert", tone: "icon-alert" },
  ],
  factors: [
    { name: "Weather", score: 70, pill: "high", pillText: "Elevated", description: "Heavy rain and spray reducing visibility inside the underpass.", icon: "weather", tone: "icon-weather" },
    { name: "Flood / roads", score: 70, pill: "high", pillText: "High", description: "Shin-level water. Stalled vehicles reported. Foot traffic not advised.", icon: "flood", tone: "icon-alert" },
    { name: "Official advisories", score: 70, pill: "high", pillText: "Elevated", description: "City flood bulletin covers this underpass. MMDA monitoring.", icon: "alert", tone: "icon-alert" },
    { name: "School status", score: 20, pill: "low", pillText: "Normal", description: "Nearby campuses have not suspended classes. This rating is for the roadway, not class status.", icon: "school", tone: "icon-ok" },
    { name: "Community reports", score: 70, pill: "high", pillText: "Several", description: "Multiple stalled-vehicle and flooding reports in the last hour.", icon: "reports", tone: "icon-alert" },
  ],
  advisories: [
    { source: "gov", label: "Government", title: "Flood bulletin: Quiapo underpass", description: "Shin-level flooding. Motorists advised to use alternate routes.", time: "5:50 AM" },
    { source: "weather", label: "Weather", title: "Heavy rain continuing", description: "Sustained rainfall over central Manila this morning.", time: "6:15 AM" },
    { source: "community", label: "Community", title: "Stalled vehicles in the underpass", description: "Several reports since 5:40 AM. Not all verified.", time: "6:05 AM" },
  ],
  reports: [
    { type: "Flooding", title: "Shin-level water in underpass", meta: "Quiapo · 6:05 AM", status: "verified", statusLabel: "Verified" },
    { type: "Transport Disruption", title: "Stalled UV Express", meta: "Quiapo underpass · 6:12 AM", status: "pending", statusLabel: "Pending" },
    { type: "Road Hazard", title: "Low visibility", meta: "Quiapo underpass · 6:05 AM", status: "unverified", statusLabel: "Unverified" },
  ],
  points: [
    { kind: "start", label: "Approach", name: "Quezon Blvd. north", detail: "Water beginning to pond" },
    { kind: "mid", label: "Watched", name: "Quiapo underpass", detail: "Shin-level · stalled vehicles" },
    { kind: "end", label: "Exit", name: "Toward Lawton", detail: "Still passable beyond the dip" },
  ],
  floods: [{ title: "Quiapo underpass", meta: "Shin-level, rising slowly · MMDA on site" }],
  hazards: [
    { title: "Stalled UV Express", meta: "Reported 6:12 AM · Pending" },
    { title: "Low visibility in underpass", meta: "Reported 6:05 AM · Unverified" },
  ],
};

const lermaInput: LocationInput = {
  id: "lerma",
  name: "Lerma St., Sampaloc",
  city: "Manila",
  aliases: ["lerma", "sampaloc"],
  coordinates: [14.6049, 120.9888],
  updated: "6:38 AM",
  riskSummary: "An open manhole is verified on Lerma. Nearby España flooding may push more water this way. Use caution on foot.",
  riskStatus: "Passable with caution",
  stats: [
    { label: "Weather", value: "Heavy rain, 25°C", detail: "Same system as España", icon: "weather", tone: "icon-weather" },
    { label: "School status", value: "Classes ongoing", detail: "Nearby Mapúa · 6:00 AM", icon: "school", tone: "icon-ok" },
    { label: "Road condition", value: "Open manhole", detail: "Verified · foot traffic caution", icon: "flood", tone: "icon-mod" },
    { label: "Latest advisory", value: "PAGASA rainfall advisory", detail: "Metro Manila · 6:15 AM", icon: "alert", tone: "icon-alert" },
  ],
  factors: [
    { name: "Weather", score: 52, pill: "mod", pillText: "Moderate", description: "Heavy rain continuing over Sampaloc.", icon: "weather", tone: "icon-weather" },
    { name: "Flood / roads", score: 52, pill: "mod", pillText: "Moderate", description: "Standing water plus a verified open manhole.", icon: "flood", tone: "icon-mod" },
    { name: "Official advisories", score: 40, pill: "mod", pillText: "Moderate", description: "Covered by the metro rainfall advisory. No street-specific bulletin.", icon: "alert", tone: "icon-mod" },
    { name: "School status", score: 20, pill: "low", pillText: "Normal", description: "No campus closure affecting this street.", icon: "school", tone: "icon-ok" },
    { name: "Community reports", score: 40, pill: "mod", pillText: "Active", description: "Open manhole verified. Additional flood notes nearby.", icon: "reports", tone: "icon-neutral" },
  ],
  advisories: [
    { source: "community", label: "Community", title: "Open manhole on Lerma St.", description: "Verified report. Marked and being monitored.", time: "5:55 AM" },
    { source: "gov", label: "Government", title: "PAGASA rainfall advisory: Metro Manila", description: "Moderate to heavy rainfall expected over Metro Manila.", time: "6:15 AM" },
  ],
  reports: [
    { type: "Road Hazard", title: "Open manhole reported", meta: "Lerma St. · 5:55 AM", status: "verified", statusLabel: "Verified" },
    { type: "Flooding", title: "Ankle-deep near España", meta: "Lerma / España · 6:18 AM", status: "pending", statusLabel: "Pending" },
  ],
  points: [
    { kind: "start", label: "Corner", name: "Lerma / España", detail: "Water spilling from España" },
    { kind: "end", label: "Watched", name: "Lerma St. manhole", detail: "Verified open manhole · use caution" },
  ],
  floods: [{ title: "Lerma / España corner", meta: "Ankle-deep spillover from España Blvd." }],
  hazards: [{ title: "Open manhole, Lerma St.", meta: "Reported 5:55 AM · Verified" }],
};

function cloneEspana(
  id: string,
  name: string,
  city: string,
  aliases: string[],
  coordinates: [number, number],
) {
  return createLocation({
    ...espanaInput,
    id,
    name,
    city,
    aliases,
    coordinates,
  });
}

export const LOCATIONS: SafeGoLocation[] = [
  createLocation(espanaInput),
  createLocation(makatiInput),
  createLocation(quiapoInput),
  createLocation(lermaInput),
  cloneEspana("binondo", "Binondo, Manila", "Manila", ["binondo", "manila", "divisoria", "ongpin"], [14.601, 120.9745]),
  cloneEspana("katipunan", "Katipunan Avenue, Quezon City", "Quezon City", ["katipunan", "quezon city", "qc", "ateneo", "up diliman"], [14.6405, 121.0741]),
  cloneEspana("ortigas-pasig", "Ortigas Center, Pasig", "Pasig", ["ortigas", "pasig", "ortigas center", "kapitolyo"], [14.5869, 121.0614]),
];

export function searchLocations(query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return LOCATIONS;

  return LOCATIONS.filter((location) =>
    [location.name, location.city, ...location.aliases]
      .join(" ")
      .toLocaleLowerCase()
      .includes(normalizedQuery),
  );
}
