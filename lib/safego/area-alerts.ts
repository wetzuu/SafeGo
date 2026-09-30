/** An active PAGASA public alert from SafeGo's /api/alerts/active (CAP, CC BY 4.0). */
export interface ActiveAlert {
  id: string;
  event: string;
  headline: string;
  description: string;
  severity: string;
  /** SafeGo's 0–100 mapping of CAP severity; see docs/SOURCE_FEEDS.md. */
  severityScore: number;
  urgency: string;
  certainty: string;
  issuedAt: string | null;
  expiresAt: string;
  sourceUrl: string;
  /** Polygon points are [latitude, longitude]. */
  areas: Array<{ description: string; polygons: Array<Array<[number, number]>> }>;
}

export interface AreaAdvisory {
  /** Highest severity among covering alerts; 0 when PAGASA has no active alert here. */
  score: number;
  alerts: ActiveAlert[];
}

function polygonContains(polygon: Array<[number, number]>, [lat, lon]: [number, number]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [latI, lonI] = polygon[i];
    const [latJ, lonJ] = polygon[j];
    if ((latI > lat) !== (latJ > lat) && lon < ((lonJ - lonI) * (lat - latI)) / (latJ - latI) + lonI) inside = !inside;
  }
  return inside;
}

export function alertsCovering(point: [number, number], alerts: ActiveAlert[]): AreaAdvisory {
  const covering = alerts.filter((alert) =>
    alert.areas.some((area) => area.polygons.some((polygon) => polygonContains(polygon, point))));
  return { score: Math.max(0, ...covering.map((alert) => alert.severityScore)), alerts: covering };
}

interface AlertsEnvelope {
  data?: { alerts: ActiveAlert[]; source: { status: string; errorMessage: string | null } };
  error?: { message?: string };
}

/** Active PAGASA alerts touching Metro Manila. Throws when the source is not active. */
export async function fetchActiveAlerts(): Promise<ActiveAlert[]> {
  const response = await fetch("/api/alerts/active", {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const envelope = (await response.json().catch(() => null)) as AlertsEnvelope | null;
  if (!response.ok || !envelope?.data) throw new Error(envelope?.error?.message ?? `Alerts returned HTTP ${response.status}.`);
  if (envelope.data.source.status !== "active") {
    throw new Error(envelope.data.source.errorMessage ?? `PAGASA alerts are ${envelope.data.source.status}.`);
  }
  return envelope.data.alerts;
}
