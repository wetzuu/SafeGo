import type { AdvisorySource } from "../safego/types.ts";
import type { SourceStatus } from "../data/contracts.ts";

export interface OfficialAdvisoryFeedItem {
  id: string;
  locationIds: string[];
  sourceName: string;
  sourceKind: AdvisorySource;
  title: string;
  description: string;
  severityScore: number;
  issuedAt: string;
  expiresAt: string;
  sourceUrl: string;
}

export interface FloodRoadFeedItem {
  id: string;
  locationIds: string[];
  sourceName: string;
  kind: "flood" | "road";
  title: string;
  description: string;
  severityScore: number;
  observedAt: string;
  expiresAt: string;
  sourceUrl: string;
}

interface FeedResult<T> {
  items: T[];
  status: SourceStatus;
}

const responseCache = new Map<string, { expiresAt: number; fetchedAt: string; value: unknown }>();
const CACHE_MS = 5 * 60 * 1000;

function requiredString(value: unknown, field: string, maxLength = 500) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength) {
    throw new Error(`Feed item ${field} must be a non-empty string of at most ${maxLength} characters.`);
  }
  return value.trim();
}

function timestamp(value: unknown, field: string) {
  const result = requiredString(value, field, 40);
  if (!Number.isFinite(Date.parse(result))) throw new Error(`Feed item ${field} must be an ISO timestamp.`);
  return new Date(result).toISOString();
}

function score(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 100) {
    throw new Error("Feed item severityScore must be an integer from 0 to 100.");
  }
  return value;
}

function locationIds(value: unknown) {
  if (!Array.isArray(value) || !value.length || value.length > 50) {
    throw new Error("Feed item locationIds must contain 1 to 50 canonical SafeGo location IDs.");
  }
  return value.map((id) => requiredString(id, "locationIds", 80));
}

function publicUrl(value: unknown, field: string) {
  const result = requiredString(value, field, 500);
  const parsed = new URL(result);
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
    throw new Error(`Feed item ${field} must use HTTPS.`);
  }
  return result;
}

function feedItems(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Feed response must be a JSON object.");
  const items = (value as { items?: unknown }).items;
  if (!Array.isArray(items) || items.length > 1000) throw new Error("Feed response items must be an array of at most 1000 entries.");
  return items as Array<Record<string, unknown>>;
}

export function parseOfficialAdvisoryFeed(value: unknown): OfficialAdvisoryFeedItem[] {
  return feedItems(value).map((item) => {
    const sourceKind = requiredString(item.sourceKind, "sourceKind", 20);
    if (!["gov", "school", "weather"].includes(sourceKind)) {
      throw new Error("Official advisory sourceKind must be gov, school, or weather.");
    }
    return {
      id: requiredString(item.id, "id", 120),
      locationIds: locationIds(item.locationIds),
      sourceName: requiredString(item.sourceName, "sourceName", 100),
      sourceKind: sourceKind as AdvisorySource,
      title: requiredString(item.title, "title", 200),
      description: requiredString(item.description, "description", 1000),
      severityScore: score(item.severityScore),
      issuedAt: timestamp(item.issuedAt, "issuedAt"),
      expiresAt: timestamp(item.expiresAt, "expiresAt"),
      sourceUrl: publicUrl(item.sourceUrl, "sourceUrl"),
    };
  });
}

export function parseFloodRoadFeed(value: unknown): FloodRoadFeedItem[] {
  return feedItems(value).map((item) => {
    const kind = requiredString(item.kind, "kind", 10);
    if (kind !== "flood" && kind !== "road") throw new Error("Flood/road item kind must be flood or road.");
    return {
      id: requiredString(item.id, "id", 120),
      locationIds: locationIds(item.locationIds),
      sourceName: requiredString(item.sourceName, "sourceName", 100),
      kind,
      title: requiredString(item.title, "title", 200),
      description: requiredString(item.description, "description", 1000),
      severityScore: score(item.severityScore),
      observedAt: timestamp(item.observedAt, "observedAt"),
      expiresAt: timestamp(item.expiresAt, "expiresAt"),
      sourceUrl: publicUrl(item.sourceUrl, "sourceUrl"),
    };
  });
}

function sourceStatus(key: string, name: string, status: SourceStatus["status"], at: string | null, errorMessage: string | null): SourceStatus {
  return {
    key,
    name,
    kind: key,
    status,
    lastSuccessAt: status === "active" ? at : null,
    lastFailureAt: status === "degraded" ? at : null,
    errorMessage,
  };
}

async function fetchFeed<T extends { id: string; expiresAt: string }>({ key, name, endpoint, token, parser }: { key: string; name: string; endpoint: string | undefined; token: string | undefined; parser: (value: unknown) => T[] }): Promise<FeedResult<T>> {
  if (!endpoint?.trim()) return { items: [], status: sourceStatus(key, name, "disabled", null, null) };
  const now = new Date().toISOString();
  try {
    const checkedEndpoint = publicUrl(endpoint.trim(), "endpoint");
    const cacheKey = `${key}:${checkedEndpoint}`;
    const cached = responseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { items: cached.value as T[], status: sourceStatus(key, name, "active", cached.fetchedAt, null) };
    }
    const response = await fetch(checkedEndpoint, {
      headers: {
        Accept: "application/json",
        "User-Agent": "SafeGo/0.1 operational-source-ingestion",
        ...(token?.trim() ? { Authorization: `Bearer ${token.trim()}` } : {}),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`Source returned HTTP ${response.status}.`);
    const active = parser(await response.json()).filter((item) => Date.parse(item.expiresAt) > Date.now());
    const parsed = Array.from(new Map(active.map((item) => [item.id, item])).values());
    responseCache.set(cacheKey, { expiresAt: Date.now() + CACHE_MS, fetchedAt: now, value: parsed });
    return { items: parsed, status: sourceStatus(key, name, "active", now, null) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown source error.";
    return { items: [], status: sourceStatus(key, name, "degraded", now, message) };
  }
}

export function fetchOfficialAdvisoryFeed() {
  return fetchFeed({
    key: "official-advisories",
    name: "Configured official advisory feed",
    endpoint: process.env.SAFEGO_OFFICIAL_ADVISORY_FEED_URL,
    token: process.env.SAFEGO_OFFICIAL_ADVISORY_FEED_TOKEN,
    parser: parseOfficialAdvisoryFeed,
  });
}

export function fetchFloodRoadFeed() {
  return fetchFeed({
    key: "flood-road",
    name: "Configured flood and road feed",
    endpoint: process.env.SAFEGO_FLOOD_ROAD_FEED_URL,
    token: process.env.SAFEGO_FLOOD_ROAD_FEED_TOKEN,
    parser: parseFloodRoadFeed,
  });
}
