/**
 * Live events from SafeGo's server (GET /api/events, Server-Sent Events). The browser's EventSource
 * reconnects by itself and sends Last-Event-ID, so the server replays what it missed.
 */

export interface WeatherEscalatedEvent {
  type: "WEATHER_ESCALATED";
  from: "CLEAR" | "LIGHT_RAIN" | "SEVERE";
  to: "CLEAR" | "LIGHT_RAIN" | "SEVERE";
  reason: string;
  at: string;
}

export interface UniversityAdvisoryEvent {
  type: "UNIVERSITY_ADVISORY";
  universityId: string;
  universityName: string;
  lguCode: string;
  /** The scanner reports SUSPENDED or ASYNCHRONOUS; NORMAL is reserved for school admins. */
  status: "SUSPENDED" | "ASYNCHRONOUS" | "NORMAL";
  /** UNSPECIFIED when the notice does not say which levels. */
  scope: "ALL_LEVELS" | "TERTIARY_ONLY" | "UNSPECIFIED";
  issuedAt: string;
  message: string;
  sourceName: string;
  sourceUrl: string;
  /** False for news reports, which are not the school's or government's own notice. */
  verified: boolean;
  areaWide: boolean;
  origin: "scanner" | "school-admin";
}

export type LiveEvent = WeatherEscalatedEvent | UniversityAdvisoryEvent;

export const LIVE_EVENT_TYPES = ["WEATHER_ESCALATED", "UNIVERSITY_ADVISORY"] as const;

/** Reads one event; null for anything malformed or unknown, which is ignored. */
export function parseLiveEvent(type: string, data: string): LiveEvent | null {
  try {
    const value = JSON.parse(data) as Partial<LiveEvent>;
    if (type === "WEATHER_ESCALATED" && value?.type === type && typeof value.to === "string") return value as WeatherEscalatedEvent;
    if (type === "UNIVERSITY_ADVISORY" && value?.type === type && typeof (value as UniversityAdvisoryEvent).universityId === "string") {
      return value as UniversityAdvisoryEvent;
    }
  } catch {
    // Not JSON: ignore.
  }
  return null;
}

/** One short line for the app to show when an event arrives. */
export function describeLiveEvent(event: LiveEvent): string {
  if (event.type === "WEATHER_ESCALATED") {
    return "Rain has reached the campus areas. SafeGo is checking schools for class suspensions.";
  }
  const what = event.status === "SUSPENDED" ? "classes suspended" : event.status === "ASYNCHRONOUS" ? "classes moved online" : "classes back to normal";
  const levels = event.scope === "ALL_LEVELS" ? " for all levels" : "";
  const trust = event.verified ? "" : " (news report, not yet the school's own notice)";
  return `${event.universityName}: ${what}${levels}${trust}.`;
}

/** Listens for live events; returns a function that stops listening. */
export function subscribeToLiveEvents(onEvent: (event: LiveEvent) => void, universityId?: string): () => void {
  if (typeof EventSource === "undefined") return () => {};
  const source = new EventSource(`/api/events${universityId ? `?universityId=${encodeURIComponent(universityId)}` : ""}`);
  for (const type of LIVE_EVENT_TYPES) {
    source.addEventListener(type, (message) => {
      const event = parseLiveEvent(type, (message as MessageEvent<string>).data);
      if (event) onEvent(event);
    });
  }
  return () => source.close();
}
