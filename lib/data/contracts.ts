import type { SafeGoLocation } from "../safego/types.ts";

export type DataBackend = "local" | "database";

export interface CommunityReportInput {
  locationId: string;
  reportType: string;
  locationText: string;
  description: string;
}

export type SourceHealth = "active" | "degraded" | "disabled";

export interface SourceStatus {
  key: string;
  name: string;
  kind: string;
  status: SourceHealth;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  errorMessage: string | null;
}

export interface DashboardSnapshot {
  locations: SafeGoLocation[];
  sources: SourceStatus[];
  weatherUpdatedAt: string | null;
}

