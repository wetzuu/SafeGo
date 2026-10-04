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

/** A made-up announcement, so people can see what a real one looks like. Always marked as a sample. */
export function sampleUniversityAlert(area: string, now: number): UniversityAlert {
  const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" }).format(new Date(now));
  return {
    area,
    proximity: -1,
    university: {
      id: SAMPLE_ANNOUNCEMENT_ID,
      name: "Mapúa University",
      campus: "Intramuros, Manila",
      logoPath: "/university-logos/mapua.webp",
      logoAlt: "Mapúa University logo",
      status: "suspended",
      statusLabel: "Classes suspended",
      announcement: "Classes at all levels are suspended today because of heavy rain and flooding near campus. Offices stay open.",
      date,
      time: "5:30 AM",
      isMock: true,
      sourceName: "Sample",
    },
  };
}

export const SAMPLE_ANNOUNCEMENT_ID = "sample-announcement";

/**
 * Announcements worth interrupting the traveller for: classes suspended or moved online, still in
 * force, and not dismissed. Ordered by urgency, then by how close the campus area is.
 * Demo entries never appear. An announcement must be verified, or be a report that links to its source.
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
      if (university.isMock || !(university.announcementVerified || university.announcementUrl)) return false;
      if (university.status !== "suspended" && university.status !== "online") return false;
      const expiry = expiresAt(university);
      return expiry === null || expiry > now;
    })
    .sort((first, second) =>
      URGENCY[first.university.status] - URGENCY[second.university.status] || first.proximity - second.proximity);
}
