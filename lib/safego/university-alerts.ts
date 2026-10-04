import type { UniversityStatus } from "./types.ts";

export interface UniversityAlert {
  university: UniversityStatus;
  /** The SafeGo area or route stop it is linked to, e.g. "España Blvd." */
  area: string;
  /** Lower is closer to the selected place or earlier on the route. */
  proximity: number;
}

/** Announcements stay relevant through the day after they were posted. */
const VALID_FOR_MS = 2 * 24 * 60 * 60 * 1000;

const URGENCY: Record<UniversityStatus["status"], number> = { suspended: 0, online: 1, open: 2, "no-update": 3 };

/** When a dated announcement stops being shown; null when the date cannot be read. */
export function expiresAt(university: UniversityStatus): number | null {
  const posted = Date.parse(`${university.date} 00:00:00 GMT+0800`);
  return Number.isFinite(posted) ? posted + VALID_FOR_MS : null;
}

/**
 * Announcements worth interrupting the traveller for: classes suspended or moved online, still in
 * force, and not dismissed. Ordered by urgency, then by how close the campus area is.
 * Only verified, non-demo announcements can interrupt the traveller.
 */
export function activeUniversityAlerts(
  candidates: UniversityAlert[],
  now: number,
  dismissed: ReadonlySet<string> = new Set(),
): UniversityAlert[] {
  const seen = new Set<string>();
  return candidates
    .filter(({ university }) => {
      if (seen.has(university.id) || dismissed.has(university.id)) return false;
      seen.add(university.id);
      if (university.isMock || !university.announcementVerified) return false;
      if (university.status !== "suspended" && university.status !== "online") return false;
      const expiry = expiresAt(university);
      return expiry === null || expiry > now;
    })
    .sort((first, second) =>
      URGENCY[first.university.status] - URGENCY[second.university.status] || first.proximity - second.proximity);
}
