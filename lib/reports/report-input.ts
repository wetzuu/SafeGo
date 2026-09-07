import type { CommunityReportInput } from "../data/contracts.ts";

export const COMMUNITY_REPORT_TYPES = [
  "Flooding",
  "Road Hazard",
  "Transport Disruption",
  "Power / Signal Outage",
  "Other",
] as const;

type ParseResult =
  | { ok: true; data: CommunityReportInput }
  | { ok: false; message: string };

function clean(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

export function parseCommunityReportInput(value: unknown): ParseResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, message: "The report body must be a JSON object." };
  }

  const body = value as Record<string, unknown>;
  const locationId = clean(body.locationId);
  const reportType = clean(body.reportType);
  const locationText = clean(body.locationText);
  const description = clean(body.description);

  if (!/^[a-z0-9-]{1,80}$/.test(locationId)) {
    return { ok: false, message: "Choose a valid SafeGo coverage location." };
  }
  if (!COMMUNITY_REPORT_TYPES.includes(reportType as typeof COMMUNITY_REPORT_TYPES[number])) {
    return { ok: false, message: "Choose a valid report type." };
  }
  if (locationText.length < 3 || locationText.length > 160) {
    return { ok: false, message: "Enter a location between 3 and 160 characters." };
  }
  if (description.length < 10 || description.length > 500) {
    return { ok: false, message: "Describe what you observed in 10 to 500 characters." };
  }

  return {
    ok: true,
    data: { locationId, reportType, locationText, description },
  };
}
