import type {
  Advisory,
  CommunityReport,
  RiskAssessment,
  RiskFactor,
  SafeGoLocation,
} from "../safego/types.ts";

export type DataBackend = "mock" | "database";

export interface LocationSummary {
  id: string;
  name: string;
  city: string;
  aliases: string[];
  coordinates: [number, number];
  updated: string;
  risk: Pick<
    RiskAssessment,
    "key" | "name" | "rank" | "percentage" | "modelVersion"
  >;
}

export interface LocationRiskDetails {
  location: LocationSummary;
  assessment: RiskAssessment;
  factors: RiskFactor[];
  advisories: Advisory[];
  communityReports: CommunityReport[];
}

export type SourceHealth = "mock" | "active" | "degraded" | "disabled";

export interface SourceStatus {
  key: string;
  name: string;
  kind: string;
  status: SourceHealth;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  errorMessage: string | null;
}

export interface SafeGoRepository {
  listLocations(): Promise<LocationSummary[]>;
  listDashboardLocations(): Promise<SafeGoLocation[]>;
  getLocationRisk(id: string): Promise<LocationRiskDetails | null>;
  listSourceStatuses(): Promise<SourceStatus[]>;
}

export interface DashboardSnapshot {
  locations: SafeGoLocation[];
  sources: SourceStatus[];
  weatherUpdatedAt: string | null;
}

export interface RepositoryContext {
  backend: DataBackend;
  repository: SafeGoRepository;
}
