import type {
  Advisory,
  CommunityReport,
  LocationInput,
  RiskAssessment,
  RiskFactor,
  SafeGoLocation,
} from "../safego/types.ts";
import type {
  LocationRiskDetails,
  LocationSummary,
  SafeGoRepository,
  SourceHealth,
  SourceStatus,
} from "./contracts.ts";
import { getDatabase } from "./database.ts";

interface LocationRow {
  id: string;
  name: string;
  city: string;
  aliases: string[];
  latitude: number;
  longitude: number;
  updated_label: string;
  assessment: RiskAssessment;
}

interface LocationDetailsRow extends LocationRow {
  display_payload: LocationInput;
  factors: RiskFactor[];
  advisories: Advisory[];
  community_reports: CommunityReport[];
}

function toDashboardLocation(row: LocationDetailsRow): SafeGoLocation {
  return {
    ...row.display_payload,
    id: row.id,
    name: row.name,
    city: row.city,
    aliases: row.aliases,
    coordinates: [Number(row.latitude), Number(row.longitude)],
    updated: row.updated_label,
    factors: row.factors,
    advisories: row.advisories,
    reports: row.community_reports,
    risk: row.assessment,
  };
}

interface SourceRow {
  key: string;
  name: string;
  kind: string;
  status: SourceHealth;
  last_success_at: Date | null;
  last_failure_at: Date | null;
  error_message: string | null;
}

function toLocationSummary(row: LocationRow): LocationSummary {
  const { key, name, rank, percentage, modelVersion } = row.assessment;

  return {
    id: row.id,
    name: row.name,
    city: row.city,
    aliases: row.aliases,
    coordinates: [Number(row.latitude), Number(row.longitude)],
    updated: row.updated_label,
    risk: { key, name, rank, percentage, modelVersion },
  };
}

export class PostgresSafeGoRepository implements SafeGoRepository {
  async listLocations() {
    const sql = getDatabase();
    const rows = await sql<LocationRow[]>`
      SELECT
        l.id,
        l.name,
        l.city,
        l.aliases,
        ST_Y(l.position::geometry) AS latitude,
        ST_X(l.position::geometry) AS longitude,
        l.updated_label,
        latest.assessment
      FROM locations l
      JOIN LATERAL (
        SELECT assessment
        FROM risk_assessments
        WHERE location_id = l.id
        ORDER BY calculated_at DESC
        LIMIT 1
      ) latest ON true
      ORDER BY l.name
    `;

    return rows.map(toLocationSummary);
  }

  async listDashboardLocations() {
    const sql = getDatabase();
    const rows = await sql<LocationDetailsRow[]>`
      SELECT
        l.id,
        l.name,
        l.city,
        l.aliases,
        ST_Y(l.position::geometry) AS latitude,
        ST_X(l.position::geometry) AS longitude,
        l.updated_label,
        l.display_payload,
        latest.assessment,
        COALESCE(latest.factors, '[]'::jsonb) AS factors,
        COALESCE((
          SELECT jsonb_agg(a.payload ORDER BY a.issued_at DESC)
          FROM advisories a
          WHERE a.location_id = l.id
        ), '[]'::jsonb) AS advisories,
        COALESCE((
          SELECT jsonb_agg(r.payload ORDER BY r.reported_at DESC)
          FROM community_reports r
          WHERE r.location_id = l.id
        ), '[]'::jsonb) AS community_reports
      FROM locations l
      JOIN LATERAL (
        SELECT assessment, factors
        FROM risk_assessments
        WHERE location_id = l.id
        ORDER BY calculated_at DESC
        LIMIT 1
      ) latest ON true
      ORDER BY l.name
    `;

    return rows.map(toDashboardLocation);
  }

  async getLocationRisk(id: string): Promise<LocationRiskDetails | null> {
    const sql = getDatabase();
    const rows = await sql<LocationDetailsRow[]>`
      SELECT
        l.id,
        l.name,
        l.city,
        l.aliases,
        ST_Y(l.position::geometry) AS latitude,
        ST_X(l.position::geometry) AS longitude,
        l.updated_label,
        l.display_payload,
        latest.assessment,
        COALESCE(latest.factors, '[]'::jsonb) AS factors,
        COALESCE((
          SELECT jsonb_agg(a.payload ORDER BY a.issued_at DESC)
          FROM advisories a
          WHERE a.location_id = l.id
        ), '[]'::jsonb) AS advisories,
        COALESCE((
          SELECT jsonb_agg(r.payload ORDER BY r.reported_at DESC)
          FROM community_reports r
          WHERE r.location_id = l.id
        ), '[]'::jsonb) AS community_reports
      FROM locations l
      JOIN LATERAL (
        SELECT assessment, factors
        FROM risk_assessments
        WHERE location_id = l.id
        ORDER BY calculated_at DESC
        LIMIT 1
      ) latest ON true
      WHERE l.id = ${id}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) return null;

    const dashboardLocation = toDashboardLocation(row);
    return {
      location: toLocationSummary(row),
      assessment: dashboardLocation.risk,
      factors: dashboardLocation.factors,
      advisories: dashboardLocation.advisories,
      communityReports: dashboardLocation.reports,
    };
  }

  async listSourceStatuses(): Promise<SourceStatus[]> {
    const sql = getDatabase();
    const rows = await sql<SourceRow[]>`
      SELECT key, name, kind, status, last_success_at, last_failure_at, error_message
      FROM data_sources
      ORDER BY name
    `;

    return rows.map((row) => ({
      key: row.key,
      name: row.name,
      kind: row.kind,
      status: row.status,
      lastSuccessAt: row.last_success_at?.toISOString() ?? null,
      lastFailureAt: row.last_failure_at?.toISOString() ?? null,
      errorMessage: row.error_message,
    }));
  }
}
