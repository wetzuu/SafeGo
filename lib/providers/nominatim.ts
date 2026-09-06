import "server-only";

import type { SafeGoLocation } from "../safego/types.ts";
import type { ResolvedPlace } from "../trips/types.ts";

const DEFAULT_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const cache = new Map<string, { value: ResolvedPlace; expiresAt: number }>();
let queue: Promise<void> = Promise.resolve();
let lastRequestAt = 0;

function normalized(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function presetMatch(query: string, locations: SafeGoLocation[]) {
  const target = normalized(query);
  return locations.find((location) =>
    [location.id, location.name, ...location.aliases].some((candidate) => {
      const normalizedCandidate = normalized(candidate);
      return (
        normalizedCandidate === target ||
        (normalizedCandidate.includes(" ") &&
          normalizedCandidate.length >= 8 &&
          target.includes(normalizedCandidate))
      );
    }),
  );
}

async function respectPublicRateLimit() {
  const remaining = 1_050 - (Date.now() - lastRequestAt);
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
  lastRequestAt = Date.now();
}

async function queryNominatim(query: string): Promise<ResolvedPlace> {
  const task = queue.then(async () => {
    await respectPublicRateLimit();
    const endpoint = process.env.SAFEGO_GEOCODING_BASE_URL || DEFAULT_ENDPOINT;
    const parameters = new URLSearchParams({
      q: query,
      format: "jsonv2",
      limit: "1",
      countrycodes: "ph",
      addressdetails: "0",
    });
    const contact = process.env.SAFEGO_CONTACT_EMAIL?.trim();
    const response = await fetch(`${endpoint}?${parameters}`, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Accept-Language": "en",
        "User-Agent": `SafeGo-Prototype/0.1${contact ? ` (${contact})` : " (local development)"}`,
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`Geocoding service returned HTTP ${response.status}.`);
    }
    const results = (await response.json()) as Array<{
      display_name: string;
      lat: string;
      lon: string;
    }>;
    const result = results[0];
    if (!result) throw new Error(`No Philippine location found for “${query}”.`);

    return {
      label: result.display_name,
      coordinates: [Number(result.lat), Number(result.lon)] as [number, number],
      source: "nominatim" as const,
      matchedLocationId: null,
      approximate: true,
    };
  });
  queue = task.then(() => undefined, () => undefined);
  return task;
}

export async function resolvePlace(
  query: string,
  locations: SafeGoLocation[],
): Promise<ResolvedPlace> {
  const preset = presetMatch(query, locations);
  if (preset) {
    return {
      label: preset.name,
      coordinates: preset.coordinates,
      source: "preset",
      matchedLocationId: preset.id,
      approximate: true,
    };
  }

  const key = normalized(query);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const value = await queryNominatim(query);
  cache.set(key, { value, expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
  return value;
}
