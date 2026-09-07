import { LOCATIONS } from "../safego/locations.ts";
import type { SafeGoLocation } from "../safego/types.ts";
import type {
  CommunityReportInput,
  LocationRiskDetails,
  LocationSummary,
  SafeGoRepository,
  SourceStatus,
} from "./contracts.ts";

const submittedReports = new Map<string, SafeGoLocation["reports"]>();
const MAX_SESSION_REPORTS_PER_LOCATION = 100;

function reportsFor(location: SafeGoLocation) {
  return [...(submittedReports.get(location.id) ?? []), ...location.reports];
}

function summarize(location: SafeGoLocation): LocationSummary {
  const { key, name, rank, percentage, modelVersion } = location.risk;

  return {
    id: location.id,
    name: location.name,
    city: location.city,
    aliases: location.aliases,
    coordinates: location.coordinates,
    updated: location.updated,
    risk: { key, name, rank, percentage, modelVersion },
  };
}

export class MockSafeGoRepository implements SafeGoRepository {
  async listLocations() {
    return LOCATIONS.map(summarize);
  }

  async listDashboardLocations() {
    return LOCATIONS.map((location) => ({
      ...location,
      reports: reportsFor(location),
    }));
  }

  async getLocationRisk(id: string): Promise<LocationRiskDetails | null> {
    const location = LOCATIONS.find((candidate) => candidate.id === id);
    if (!location) return null;

    return {
      location: summarize(location),
      assessment: location.risk,
      factors: location.factors,
      advisories: location.advisories,
      communityReports: reportsFor(location),
    };
  }

  async listSourceStatuses(): Promise<SourceStatus[]> {
    return [
      {
        key: "prototype-mock",
        name: "SafeGo prototype dataset",
        kind: "mock",
        status: "mock",
        lastSuccessAt: null,
        lastFailureAt: null,
        errorMessage: null,
      },
    ];
  }

  async submitCommunityReport(input: CommunityReportInput) {
    const location = LOCATIONS.find((candidate) => candidate.id === input.locationId);
    if (!location) return null;

    const report = {
      type: input.reportType,
      title: input.description,
      meta: `${input.locationText} · ${new Intl.DateTimeFormat("en-PH", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "Asia/Manila",
      }).format(new Date())}`,
      status: "unverified" as const,
      statusLabel: "UNVERIFIED",
    };
    submittedReports.set(location.id, [
      report,
      ...(submittedReports.get(location.id) ?? []),
    ].slice(0, MAX_SESSION_REPORTS_PER_LOCATION));
    return report;
  }
}
