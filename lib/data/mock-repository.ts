import { LOCATIONS } from "../safego/locations.ts";
import type { SafeGoLocation } from "../safego/types.ts";
import type {
  LocationRiskDetails,
  LocationSummary,
  SafeGoRepository,
  SourceStatus,
} from "./contracts.ts";

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
    return LOCATIONS;
  }

  async getLocationRisk(id: string): Promise<LocationRiskDetails | null> {
    const location = LOCATIONS.find((candidate) => candidate.id === id);
    if (!location) return null;

    return {
      location: summarize(location),
      assessment: location.risk,
      factors: location.factors,
      advisories: location.advisories,
      communityReports: location.reports,
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
}
