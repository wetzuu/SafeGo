import { analyzeRisk } from "./risk-model.ts";
import type { LocationInput, SafeGoLocation } from "./types";

const DEMO_SNAPSHOT_DATE = "Sep 14, 2026";

function createLocation(input: LocationInput): SafeGoLocation {
  return {
    ...input,
    universities: input.universities ?? [],
    advisories: input.advisories.map((advisory) => ({
      ...advisory,
      date: advisory.date ?? DEMO_SNAPSHOT_DATE,
      isMock: true,
    })),
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
    { source: "weather", label: "PAGASA", title: "Orange Rainfall Warning for Metro Manila", description: "Demo announcement only. Heavy rainfall may cause flooding in low-lying areas within the next three hours. This is not an active PAGASA warning.", time: "6:15 AM", isMock: true },
    { source: "school", label: "School", title: "Mapúa University: classes proceed as scheduled", description: "No suspension announced. Monitor road conditions and allot extra travel time.", time: "6:00 AM" },
    { source: "weather", label: "Weather", title: "Localized flood watch: España / Sampaloc", description: "Street-level flooding possible in low-lying sections due to sustained rainfall.", time: "5:50 AM" },
    { source: "community", label: "Community", title: "Slow traffic along Quezon Blvd.", description: "Aggregated from 4 reports in the last hour. Pending official verification.", time: "5:40 AM" },
  ],
  universities: [
    { id: "ust-manila", name: "University of Santo Tomas", campus: "España, Manila", logoPath: "/university-logos/ust.png", logoAlt: "University of Santo Tomas seal", status: "open", statusLabel: "No demo suspension", announcement: "This example does not include a class suspension for this campus. Check official university announcements before leaving.", date: DEMO_SNAPSHOT_DATE, time: "6:00 AM", isMock: true },
    { id: "feu-manila", name: "Far Eastern University", campus: "Nicanor Reyes Street, Manila", logoPath: "/university-logos/feu.webp", logoAlt: "Far Eastern University seal", status: "no-update", statusLabel: "No update available", announcement: "SafeGo has no current suspension announcement for this campus. This does not confirm that classes are ongoing.", date: DEMO_SNAPSHOT_DATE, time: "5:55 AM", isMock: true },
  ],
  reports: [
    { type: "Flooding", title: "Ankle-deep flooding", meta: "España Blvd. corner Morayta · 6:20 AM", status: "pending", statusLabel: "Pending" },
    { type: "Road Hazard", title: "Open manhole reported", meta: "Lerma St. · 5:55 AM", status: "verified", statusLabel: "Verified" },
    { type: "Transport Disruption", title: "Jeepney route rerouted", meta: "Quezon Blvd. · 5:40 AM", status: "unverified", statusLabel: "Unverified" },
  ],
  points: [
    { kind: "start", label: "North of area", name: "Lacson / España", detail: "Dry at this end of the road" },
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
  riskSummary: "Campus grounds are dry. Some nearby Makati roads have localized flooding, but access to the campus is currently clear.",
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
  universities: [
    { id: "mapua-makati-campus", name: "Mapúa University", campus: "Makati Campus", logoPath: "/university-logos/mapua.webp", logoAlt: "Mapúa University logo", status: "online", statusLabel: "Online on Sep 10", announcement: "Confirmed past advisory: all Mapúa campuses shifted to online synchronous classes on September 10, 2026 because of prevailing weather conditions.", date: "Sep 10, 2026", time: "Official post", isMock: false, sourceName: "Mapúa University", announcementUrl: "https://www.facebook.com/share/p/18ViaW1A7k/", announcementVerified: true },
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
  universities: [
    { id: "san-sebastian-manila", name: "San Sebastian College-Recoletos", campus: "C. M. Recto Avenue, Manila", logoPath: "/university-logos/sscr.png", logoAlt: "San Sebastian College-Recoletos seal", status: "online", statusLabel: "Online in this example", announcement: "This example shows classes using alternative delivery. Confirm the current class arrangement with the college.", date: DEMO_SNAPSHOT_DATE, time: "6:05 AM", isMock: true },
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
  universities: [
    { id: "feu-manila", name: "Far Eastern University", campus: "Nicanor Reyes Street, Manila", logoPath: "/university-logos/feu.webp", logoAlt: "Far Eastern University seal", status: "no-update", statusLabel: "No update available", announcement: "SafeGo has no current suspension announcement for this nearby campus. Confirm through FEU's official channel.", date: DEMO_SNAPSHOT_DATE, time: "5:55 AM", isMock: true },
    { id: "ue-manila", name: "University of the East", campus: "C. M. Recto Avenue, Manila", logoPath: "/university-logos/ue.png", logoAlt: "University of the East anniversary logo", status: "open", statusLabel: "No demo suspension", announcement: "This example does not include a suspension for this campus. Road hazards near Lerma may still affect the trip.", date: DEMO_SNAPSHOT_DATE, time: "6:00 AM", isMock: true },
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

const pasigInput: LocationInput = {
  id: "ortigas-pasig",
  name: "Ortigas Center, Pasig",
  city: "Pasig",
  aliases: ["ortigas", "pasig", "ortigas center", "kapitolyo"],
  coordinates: [14.5869, 121.0614],
  updated: "6:45 AM",
  riskSummary: "Rain is affecting parts of Ortigas Center, but this example shows main access roads as passable. Check current city and campus announcements before leaving.",
  riskStatus: "Passable with caution",
  stats: [
    { label: "Weather", value: "Moderate rain, 26°C", detail: "Gusts to 32 km/h", icon: "weather", tone: "icon-weather" },
    { label: "School status", value: "Mixed announcements", detail: "1 demo suspension · 1 awaiting update", icon: "school", tone: "icon-mod" },
    { label: "Road condition", value: "Wet roads", detail: "Slow movement near low-lying intersections", icon: "flood", tone: "icon-mod" },
    { label: "Latest advisory", value: "Monitor Pasig updates", detail: "Demo city notice · 6:30 AM", icon: "alert", tone: "icon-mod" },
  ],
  factors: [
    { name: "Weather", score: 44, pill: "mod", pillText: "Moderate", description: "Estimated moderate rain over Ortigas Center with occasional gusts.", icon: "weather", tone: "icon-weather" },
    { name: "Flood / roads", score: 36, pill: "mod", pillText: "Watched", description: "Stored demo observations show wet roads and isolated ponding near low-lying intersections.", icon: "flood", tone: "icon-mod" },
    { name: "Official advisories", score: 40, pill: "mod", pillText: "Monitor", description: "A demo Pasig notice advises commuters to monitor localized flooding and campus updates.", icon: "alert", tone: "icon-mod" },
    { name: "School status", score: 48, pill: "mod", pillText: "Mixed", description: "Demo campus records include one suspension and one institution awaiting an update.", icon: "school", tone: "icon-mod" },
    { name: "Community reports", score: 20, pill: "low", pillText: "Limited", description: "This Pasig example has no confirmed community hazard report.", icon: "reports", tone: "icon-neutral" },
  ],
  advisories: [
    { source: "gov", label: "Pasig City", title: "Monitor low-lying roads during continued rainfall", description: "Demo announcement only. Check Pasig City DRRMO channels for an active bulletin.", time: "6:30 AM" },
    { source: "school", label: "University", title: "One nearby campus has a demo class-suspension notice", description: "See Nearby universities for institution-level status. These entries are demonstration data.", time: "6:20 AM" },
  ],
  universities: [
    {
      id: "uap-ortigas",
      name: "University of Asia and the Pacific",
      campus: "Ortigas Center",
      logoPath: "/university-logos/uap.png",
      logoAlt: "University of Asia and the Pacific crest",
      status: "suspended",
      statusLabel: "Classes suspended",
      announcement: "Demo announcement: on-campus classes are suspended for the day. Verify through the university's official channels.",
      date: DEMO_SNAPSHOT_DATE,
      time: "6:20 AM",
      isMock: true,
    },
    {
      id: "plp-pasig",
      name: "Pamantasan ng Lungsod ng Pasig",
      campus: "Pasig",
      logoPath: "/university-logos/plp.png",
      logoAlt: "Pamantasan ng Lungsod ng Pasig logo",
      status: "no-update",
      statusLabel: "No update available",
      announcement: "SafeGo has no current suspension announcement for this university. No update does not mean classes are confirmed.",
      date: DEMO_SNAPSHOT_DATE,
      time: "6:15 AM",
      isMock: true,
    },
  ],
  reports: [],
  points: [
    { kind: "start", label: "West side", name: "ADB Avenue", detail: "Wet pavement · passable in this example" },
    { kind: "mid", label: "Watched", name: "Julia Vargas Avenue", detail: "Slow movement near intersections" },
    { kind: "end", label: "East side", name: "Ortigas Avenue", detail: "Monitor low-lying sections" },
  ],
  floods: [{ title: "No verified Pasig flood observation connected", meta: "Stored demo conditions only", tone: "icon-neutral" }],
  hazards: [{ title: "Slippery roads near Ortigas intersections", meta: "Demo observation · unverified" }],
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

function createFloodProneLocation(config: {
  id: string;
  name: string;
  city: string;
  aliases: string[];
  coordinates: [number, number];
  floodTitle: string;
  floodMeta: string;
  riskSummary: string;
  riskStatus?: string;
  floodScore?: number;
  weatherScore?: number;
  advisoryScore?: number;
  points: [
    { label: string; name: string; detail: string },
    { label: string; name: string; detail: string },
    { label: string; name: string; detail: string },
  ];
  hazardTitle?: string;
  hazardMeta?: string;
}): SafeGoLocation {
  const floodScore = config.floodScore ?? 68;
  const weatherScore = config.weatherScore ?? 55;
  const advisoryScore = config.advisoryScore ?? 65;
  const floodPill = floodScore >= 80 ? "crit" : floodScore >= 60 ? "high" : floodScore >= 30 ? "mod" : "low";
  const weatherPill = weatherScore >= 80 ? "crit" : weatherScore >= 60 ? "high" : weatherScore >= 30 ? "mod" : "low";
  const advisoryPill = advisoryScore >= 80 ? "crit" : advisoryScore >= 60 ? "high" : advisoryScore >= 30 ? "mod" : "low";

  return createLocation({
    id: config.id,
    name: config.name,
    city: config.city,
    aliases: config.aliases,
    coordinates: config.coordinates,
    updated: "6:40 AM",
    riskSummary: config.riskSummary,
    riskStatus: config.riskStatus ?? "Flood hazard · delays",
    stats: [
      { label: "Weather", value: "Rain, 25°C", detail: "Active rain system", icon: "weather", tone: "icon-weather" },
      { label: "School status", value: "Monitor LGUs", detail: "Check city DRRMO bulletin", icon: "school", tone: "icon-ok" },
      { label: "Road condition", value: config.floodTitle, detail: config.floodMeta, icon: "flood", tone: "icon-alert" },
      { label: "Latest advisory", value: "Flood watch", detail: `${config.city} DRRMO alert`, icon: "alert", tone: "icon-alert" },
    ],
    factors: [
      { name: "Weather", score: weatherScore, pill: weatherPill, pillText: weatherPill === "high" ? "Elevated" : "Moderate", description: `Rain continuing over ${config.city}. Weather system active across Metro Manila.`, icon: "weather", tone: "icon-weather" },
      { name: "Flood / roads", score: floodScore, pill: floodPill, pillText: floodPill === "high" ? "High" : floodPill === "crit" ? "Critical" : "Elevated", description: `${config.floodTitle}: ${config.floodMeta}.`, icon: "flood", tone: "icon-alert" },
      { name: "Official advisories", score: advisoryScore, pill: advisoryPill, pillText: advisoryPill === "high" ? "Elevated" : "Moderate", description: `City flood bulletin and PAGASA rainfall advisory active for ${config.city}.`, icon: "alert", tone: "icon-alert" },
      { name: "School status", score: 20, pill: "low", pillText: "Normal", description: "Classes subject to local LGU suspension announcements.", icon: "school", tone: "icon-ok" },
      { name: "Community reports", score: 40, pill: "mod", pillText: "Active", description: "Community reports received and being monitored.", icon: "reports", tone: "icon-neutral" },
    ],
    advisories: [
      { source: "gov", label: config.city, title: `${config.city} DRRMO Flood Advisory`, description: `${config.floodTitle} reported. Motorists are advised to seek alternate routes.`, time: "6:10 AM" },
      { source: "weather", label: "PAGASA", title: "Metro Manila Rainfall Advisory", description: "Moderate to heavy rainfall expected over low-lying areas.", time: "6:15 AM" },
    ],
    universities: [],
    reports: [
      { type: "Flooding", title: config.floodTitle, meta: `${config.name} · 6:15 AM`, status: "verified", statusLabel: "Verified" },
    ],
    points: [
      { kind: "start", label: config.points[0].label, name: config.points[0].name, detail: config.points[0].detail },
      { kind: "mid", label: config.points[1].label, name: config.points[1].name, detail: config.points[1].detail },
      { kind: "end", label: config.points[2].label, name: config.points[2].name, detail: config.points[2].detail },
    ],
    floods: [{ title: config.floodTitle, meta: config.floodMeta, tone: "icon-alert" }],
    hazards: config.hazardTitle ? [{ title: config.hazardTitle, meta: config.hazardMeta ?? "Reported 6:10 AM · Verified" }] : [],
  });
}

export const LOCATIONS: SafeGoLocation[] = [
  createLocation(espanaInput),
  createLocation(makatiInput),
  createLocation(quiapoInput),
  createLocation(lermaInput),
  cloneEspana("binondo", "Binondo, Manila", "Manila", ["binondo", "manila", "divisoria", "ongpin"], [14.601, 120.9745]),
  cloneEspana("katipunan", "Katipunan Avenue, Quezon City", "Quezon City", ["katipunan", "quezon city", "qc", "ateneo", "up diliman"], [14.6405, 121.0741]),
  createLocation(pasigInput),
  createFloodProneLocation({
    id: "marikina-riverbanks",
    name: "Marikina Riverbanks, Marikina",
    city: "Marikina",
    aliases: ["marikina", "riverbanks", "marikina river", "tumana", "provident"],
    coordinates: [14.6346, 121.0963],
    floodTitle: "Marikina River overflow",
    floodMeta: "Waist-deep in low river parks · road closure near bridge",
    riskSummary: "Marikina River water levels elevated. Riverbanks park submerged; riverside access roads closed or impassable to light vehicles.",
    floodScore: 78,
    points: [
      { label: "North approach", name: "J.P. Rizal St.", detail: "Water ponding near curb" },
      { label: "Watched", name: "Marikina Riverbanks Center", detail: "Waist-deep flooding in low sections" },
      { label: "South exit", name: "Marcos Highway bridge", detail: "Bridge passable, slow movement" },
    ],
    hazardTitle: "Submerged riverside park walkway",
  }),
  createFloodProneLocation({
    id: "malabon-dampalit",
    name: "C-4 Road / Dampalit, Malabon",
    city: "Malabon",
    aliases: ["malabon", "dampalit", "c4", "tullahan", "concepcion", "hulong duhat"],
    coordinates: [14.6645, 120.9575],
    floodTitle: "Tullahan River tidal overflow",
    floodMeta: "Knee- to waist-deep (~45cm) · high tide convergence",
    riskSummary: "High tide combined with monsoon runoff has caused tidal overflow along C-4 and Dampalit. Light vehicles not passable.",
    floodScore: 76,
    points: [
      { label: "Approach", name: "Gov. Pascual Ave.", detail: "Gutters overflowing" },
      { label: "Watched", name: "C-4 Road / Dampalit Bridge", detail: "Knee- to waist-deep water" },
      { label: "Exit", name: "Toward Navotas boundary", detail: "Impassable to light vehicles" },
    ],
    hazardTitle: "Deep tidal flood on roadway",
  }),
  createFloodProneLocation({
    id: "navotas-nbbs",
    name: "North Bay Blvd. South (NBBS), Navotas",
    city: "Navotas",
    aliases: ["navotas", "nbbs", "r10", "fish port", "san rafael"],
    coordinates: [14.6441, 120.9535],
    floodTitle: "Coastal ponding along R-10",
    floodMeta: "Knee-deep (~35cm) · coastal gate overflow",
    riskSummary: "High tide backflow along Manila Bay dikes has flooded North Bay Boulevard South. Commercial and fish port traffic delayed.",
    floodScore: 70,
    points: [
      { label: "North approach", name: "Honorio Lopez Blvd.", detail: "Ankle-deep ponding" },
      { label: "Watched", name: "NBBS / Navotas Fish Port complex", detail: "Knee-deep tidal water" },
      { label: "South exit", name: "R-10 toward Tondo", detail: "Heavy vehicle traffic only" },
    ],
  }),
  createFloodProneLocation({
    id: "valenzuela-malinta",
    name: "MacArthur Highway, Malinta, Valenzuela",
    city: "Valenzuela",
    aliases: ["valenzuela", "malinta", "macarthur", "dalandanan", "karuhatan"],
    coordinates: [14.6933, 120.9634],
    floodTitle: "MacArthur Hwy. knee-deep flood",
    floodMeta: "Knee-deep (~40cm) · slow drainage near Malinta junction",
    riskSummary: "Continuous rain and runoff have overwhelmed roadside drainage along MacArthur Highway in Malinta. Light vehicles advised to divert.",
    floodScore: 72,
    points: [
      { label: "North approach", name: "MacArthur / Dalandanan", detail: "Water ponding in right lanes" },
      { label: "Watched", name: "Malinta junction / People's Park", detail: "Knee-deep standing water" },
      { label: "South exit", name: "Toward Karuhatan", detail: "Passable with extreme caution" },
    ],
  }),
  createFloodProneLocation({
    id: "qc-araneta",
    name: "G. Araneta Ave. / Talayan, Quezon City",
    city: "Quezon City",
    aliases: ["araneta", "talayan", "tatalon", "quezon city", "qc", "maria clara", "e rodriguez"],
    coordinates: [14.6385, 121.0030],
    floodTitle: "San Juan River catch basin flooding",
    floodMeta: "Waist-deep (~70cm) · impassable to all light vehicles",
    riskSummary: "San Juan River overflow has turned G. Araneta Avenue near Talayan into a deep flood basin. Road is closed to light traffic.",
    floodScore: 85,
    points: [
      { label: "Approach", name: "Del Monte Ave. corner Araneta", detail: "Ankle-deep water spreading" },
      { label: "Watched", name: "G. Araneta Ave. near Talayan creek", detail: "Waist-deep flood · vehicles stalled" },
      { label: "Exit", name: "Toward Quezon Ave. underpass", detail: "Traffic diversion in effect" },
    ],
    hazardTitle: "Submerged vehicle on G. Araneta",
  }),
  createFloodProneLocation({
    id: "mandaluyong-maysilo",
    name: "Maysilo Circle, Mandaluyong",
    city: "Mandaluyong",
    aliases: ["mandaluyong", "maysilo", "boni", "plainview", "city hall"],
    coordinates: [14.5772, 121.0347],
    floodTitle: "Maysilo Circle flood basin",
    floodMeta: "Knee-deep (~35cm) · pumping stations operating",
    riskSummary: "Water ponding around Maysilo Circle in front of the City Hall. Pumping stations active; slow movement along Boni Avenue.",
    floodScore: 66,
    points: [
      { label: "West approach", name: "Boni Ave. near San Francisco", detail: "Ankle-deep water" },
      { label: "Watched", name: "Maysilo Circle roundabout", detail: "Knee-deep water in inner lanes" },
      { label: "East exit", name: "Boni Ave. toward EDSA", detail: "Slow moving but passable" },
    ],
  }),
  createFloodProneLocation({
    id: "san-juan-river",
    name: "F. Manalo / San Juan River, San Juan",
    city: "San Juan",
    aliases: ["san juan", "manalo", "san juan river", "batis", "progreso"],
    coordinates: [14.6042, 121.0267],
    floodTitle: "San Juan Riverbank overflow",
    floodMeta: "Shin- to knee-deep (~30cm) · rapid river rise",
    riskSummary: "River levels along San Juan River have spilled over low embankments near F. Manalo Street. Use elevated routes.",
    floodScore: 68,
    points: [
      { label: "Approach", name: "N. Domingo St.", detail: "Passable, wet pavement" },
      { label: "Watched", name: "F. Manalo St. near riverbank", detail: "Shin- to knee-deep water" },
      { label: "Exit", name: "Blumentritt St.", detail: "Water receding slowly" },
    ],
  }),
  createFloodProneLocation({
    id: "paranaque-sucat",
    name: "Dr. A. Santos Ave. (Sucat), Parañaque",
    city: "Parañaque",
    aliases: ["paranaque", "parañaque", "sucat", "kabihasnan", "santos"],
    coordinates: [14.4988, 120.9882],
    floodTitle: "Sucat / Kabihasnan tidal flood",
    floodMeta: "Ankle- to knee-deep (~25cm) · slow drainage",
    riskSummary: "Rainfall combined with Parañaque River high tide causes localized flooding along Dr. A. Santos Avenue near Kabihasnan.",
    floodScore: 62,
    points: [
      { label: "West approach", name: "Quirino Ave. / Kabihasnan", detail: "Knee-deep near bridge" },
      { label: "Watched", name: "Dr. A. Santos Ave. near SM Sucat", detail: "Ankle-deep water in outer lanes" },
      { label: "East exit", name: "Sucat interchange approach", detail: "Passable, heavy congestion" },
    ],
  }),
  createFloodProneLocation({
    id: "pasay-rotonda",
    name: "Taft Ave. / EDSA Rotonda, Pasay",
    city: "Pasay",
    aliases: ["pasay", "rotonda", "taft", "edsa", "baclaran", "malibay"],
    coordinates: [14.5378, 120.9995],
    floodTitle: "Pasay Rotonda flash ponding",
    floodMeta: "Shin-deep (~20cm) · drainage backup at transit hub",
    riskSummary: "Heavy surface runoff has backed up drainage around the MRT/LRT Pasay Rotonda intersection. Expect heavy delays.",
    floodScore: 58,
    points: [
      { label: "North approach", name: "Taft Ave. near Zamora", detail: "Ponding in curb lanes" },
      { label: "Watched", name: "Taft / EDSA Rotonda underpass", detail: "Shin-deep water near stairs" },
      { label: "South exit", name: "Toward Baclaran", detail: "Slow movement, passable" },
    ],
  }),
  createFloodProneLocation({
    id: "taguig-c6",
    name: "C-6 Road / Hagonoy, Taguig",
    city: "Taguig",
    aliases: ["taguig", "c6", "hagonoy", "lakeshore", "lower bicutan"],
    coordinates: [14.5098, 121.0742],
    floodTitle: "Laguna Lake shoreline flood watch",
    floodMeta: "Knee-deep (~35cm) · lake water spillover",
    riskSummary: "High water levels in Laguna de Bay have pushed lake water over roadside sections of C-6 Road in Hagonoy. Light vehicles avoid.",
    floodScore: 70,
    points: [
      { label: "North approach", name: "C-6 Lakeshore entrance", detail: "Water reaching shoulder" },
      { label: "Watched", name: "C-6 Hagonoy low dike section", detail: "Knee-deep lake overflow" },
      { label: "South exit", name: "Toward Lower Bicutan", detail: "Single lane passable" },
    ],
  }),
  createFloodProneLocation({
    id: "laspinas-zapote",
    name: "Alabang–Zapote Road, Zapote, Las Piñas",
    city: "Las Piñas",
    aliases: ["las pinas", "las piñas", "zapote", "alabang zapote", "talaba"],
    coordinates: [14.4635, 120.9765],
    floodTitle: "Zapote River bridge overflow",
    floodMeta: "Knee-deep (~40cm) · critical bottleneck",
    riskSummary: "Zapote River has overflowed near the Las Piñas–Bacoor boundary, flooding Alabang–Zapote Road. Traffic severely gridlocked.",
    floodScore: 74,
    points: [
      { label: "East approach", name: "Alabang–Zapote near Diego Cera", detail: "Water ponding in center" },
      { label: "Watched", name: "Zapote Bridge junction", detail: "Knee-deep flooding across lanes" },
      { label: "West exit", name: "Toward Aguinaldo Hwy.", detail: "Heavy vehicle traffic only" },
    ],
  }),
  createFloodProneLocation({
    id: "muntinlupa-bayanan",
    name: "National Road, Bayanan, Muntinlupa",
    city: "Muntinlupa",
    aliases: ["muntinlupa", "bayanan", "alabang", "putatan", "poblacion"],
    coordinates: [14.4081, 121.0415],
    floodTitle: "Bayanan lakeshore ponding",
    floodMeta: "Ankle- to shin-deep (~20cm) · lake backflow",
    riskSummary: "Prolonged rains and high lake levels in Laguna de Bay cause water to pond along National Road in Bayanan.",
    floodScore: 56,
    points: [
      { label: "North approach", name: "National Road near Alabang viaduct", detail: "Passable, wet pavement" },
      { label: "Watched", name: "National Road, Bayanan market", detail: "Shin-deep standing water" },
      { label: "South exit", name: "Toward Putatan / City Hall", detail: "Slow moving but clear" },
    ],
  }),
  createFloodProneLocation({
    id: "caloocan-monumento",
    name: "Monumento / Samson Road, Caloocan",
    city: "Caloocan",
    aliases: ["caloocan", "kalookan", "monumento", "samson", "mcu", "edsa"],
    coordinates: [14.6575, 120.9836],
    floodTitle: "Monumento Circle road ponding",
    floodMeta: "Ankle- to shin-deep (~20cm) · drain blockage",
    riskSummary: "Surface runoff has accumulated around the Monumento roundabout and Samson Road. Transit and jeepney queues delayed.",
    floodScore: 54,
    points: [
      { label: "East approach", name: "EDSA toward Monumento", detail: "Ponding in outer bus lane" },
      { label: "Watched", name: "Monumento Circle / Samson Rd.", detail: "Shin-deep flood at corner" },
      { label: "West exit", name: "Samson Rd. toward Malabon", detail: "Passable with delay" },
    ],
  }),
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
