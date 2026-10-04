"use client";

import { useEffect, useRef, useState } from "react";
import type { SafeGoLocation } from "@/lib/safego/types";
import type { TripAnalysis } from "@/lib/trips/types";
import type { AccountProfile, SavedPlace } from "@/lib/account/types";
import type { PreviewTripRoute } from "./RiskMap";

interface TripEnvelope {
  data?: TripAnalysis;
  error?: { message?: string };
}

interface PlaceSuggestion {
  label: string;
  detail: string;
  coordinates: [number, number];
  matchedLocation?: SafeGoLocation;
}

function friendlyRouteError(status: number) {
  if (status === 400) return "Check both place names and try again.";
  if (status === 404) return "We couldn’t find a road route between those places. Try nearby landmarks or roads.";
  if (status === 422) return "SafeGo cannot check that trip yet. Try searching for specific Philippine landmarks or roads.";
  return "SafeGo couldn’t check this route right now. Check your connection and try again.";
}

function normalized(value: string) {
  return value.trim().toLocaleLowerCase();
}

function findLocation(locations: SafeGoLocation[], query: string) {
  const value = normalized(query);
  return locations.find((location) =>
    [location.name, location.city, ...location.aliases]
      .some((candidate) => normalized(candidate) === value),
  );
}

export function TripPlanner({
  locations,
  onLocation,
  onTrip,
  onPreviewRoute,
  account,
  initialOrigin,
  initialDestination,
}: {
  locations: SafeGoLocation[];
  onLocation: (location: SafeGoLocation) => void;
  onTrip: (trip: TripAnalysis) => void;
  onPreviewRoute?: (preview: PreviewTripRoute | null) => void;
  account: AccountProfile | null;
  initialOrigin?: string;
  initialDestination?: string;
}) {
  const [stops, setStops] = useState<string[]>(() => {
    if (initialOrigin && initialDestination) return [initialOrigin, initialDestination];
    if (initialOrigin) return [initialOrigin];
    return [""];
  });
  const [savedStops, setSavedStops] = useState<Array<SavedPlace | null>>(() =>
    initialOrigin && initialDestination ? [null, null] : [null]);
  const [activeInputIndex, setActiveInputIndex] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{ key: string; distanceKm: number; durationMin: number; roadNames: string[] } | null>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchAbort = useRef<AbortController | null>(null);

  useEffect(() => () => {
    activeRequest.current?.abort();
    searchAbort.current?.abort();
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
  }, []);

  const originCoord = savedStops[0]?.coordinates;
  const destCoord = savedStops[1]?.coordinates;
  const originLabel = stops[0];
  const destLabel = stops[1];
  const previewKey = originCoord && destCoord ? `${originCoord.join(",")};${destCoord.join(",")}` : null;
  const previewInfo = preview && preview.key === previewKey ? preview : null;

  // Fetch an OSRM preview route as soon as both ends have coordinates.
  useEffect(() => {
    if (!originCoord || !destCoord || !previewKey) {
      onPreviewRoute?.(null);
      return;
    }

    const key = previewKey;
    const start: [number, number] = originCoord;
    const end: [number, number] = destCoord;
    let cancelled = false;

    async function fetchPreview() {
      try {
        const response = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson&steps=true`,
          { headers: { Accept: "application/json" } },
        );
        if (!response.ok) return;
        const data = await response.json();
        const route = data.routes?.[0];
        if (route && !cancelled) {
          const coords: Array<[number, number]> = route.geometry.coordinates.map(
            ([lon, lat]: [number, number]) => [lat, lon],
          );
          const distanceKm = Math.round((route.distance / 1000) * 10) / 10;
          const durationMin = Math.round(route.duration / 60);
          const roadNames: string[] = Array.from(
            new Set(
              route.legs?.flatMap((leg: { steps?: Array<{ name?: string }> }) =>
                leg.steps?.map((st) => st.name?.trim()).filter(Boolean),
              ),
            ),
          ).slice(0, 3) as string[];

          const previewRoute: PreviewTripRoute = {
            routeCoordinates: coords,
            origin: { coordinates: start, label: originLabel || "Point A" },
            destination: { coordinates: end, label: destLabel || "Point B" },
            distanceKm,
            durationMin,
            roadNames,
          };
          onPreviewRoute?.(previewRoute);
          setPreview({ key, distanceKm, durationMin, roadNames });
        }
      } catch {}
    }

    void fetchPreview();
    return () => {
      cancelled = true;
    };
  }, [previewKey, originLabel, destLabel, onPreviewRoute]); // eslint-disable-line react-hooks/exhaustive-deps -- coordinates are captured by previewKey

  const hasDestination = stops.length === 2;

  function updateStop(index: number, value: string) {
    setStops((current) => current.map((stop, stopIndex) =>
      stopIndex === index ? value : stop,
    ));
    setSavedStops((current) => current.map((place, stopIndex) => stopIndex === index ? null : place));
    setError("");
    searchPlaces(value);
  }

  function searchPlaces(value: string) {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchAbort.current?.abort();

    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setLoadingSuggestions(false);
      return;
    }

    setLoadingSuggestions(true);
    searchDebounce.current = setTimeout(async () => {
      const controller = new AbortController();
      searchAbort.current = controller;

      const norm = normalized(trimmed);
      const localMatches: PlaceSuggestion[] = locations
        .filter((loc) =>
          [loc.name, loc.city, ...loc.aliases].some((cand) => normalized(cand).includes(norm)))
        .map((loc) => ({
          label: loc.name,
          detail: `${loc.city} · SafeGo Location`,
          coordinates: loc.coordinates,
          matchedLocation: loc,
        }));

      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(trimmed)}&format=jsonv2&countrycodes=ph&limit=5&addressdetails=1`,
          {
            headers: { Accept: "application/json" },
            signal: controller.signal,
          },
        );
        if (!response.ok) throw new Error("Search service error");
        const osmResults = (await response.json()) as Array<{
          display_name: string;
          name?: string;
          lat: string;
          lon: string;
        }>;

        const osmSuggestions: PlaceSuggestion[] = osmResults.map((item) => {
          const parts = item.display_name.split(", ");
          const shortTitle = item.name || parts[0];
          const rest = parts.slice(item.name ? 0 : 1, 4).join(", ");
          return {
            label: shortTitle,
            detail: rest || item.display_name,
            coordinates: [Number(item.lat), Number(item.lon)],
          };
        });

        // Combine local preset matches and OSM results without duplicating exact names
        const combined = [...localMatches];
        for (const osm of osmSuggestions) {
          if (!combined.some((item) => normalized(item.label) === normalized(osm.label))) {
            combined.push(osm);
          }
        }
        setSuggestions(combined.slice(0, 6));
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setSuggestions(localMatches);
        }
      } finally {
        if (!controller.signal.aborted) setLoadingSuggestions(false);
      }
    }, 300);
  }

  function pickSuggestion(index: number, suggestion: PlaceSuggestion) {
    setStops((current) => current.map((s, idx) => idx === index ? suggestion.label : s));
    setSavedStops((current) => current.map((s, idx) => idx === index ? {
      label: suggestion.label,
      canonicalLabel: suggestion.detail,
      coordinates: suggestion.coordinates,
      source: suggestion.matchedLocation ? "preset" : "nominatim",
      matchedLocationId: suggestion.matchedLocation?.id ?? null,
      approximate: true,
    } : s));
    setSuggestions([]);
    setActiveInputIndex(null);
  }

  async function analyzeRoute(origin: string, destination: string, resolved = savedStops) {
    if (activeRequest.current) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/trips/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin,
          destination,
          originCoordinates: resolved[0]?.coordinates ?? null,
          destinationCoordinates: resolved[1]?.coordinates ?? null,
        }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(25_000)]),
      });
      const envelope = await response.json().catch(() => null) as TripEnvelope | null;
      const analysis = envelope?.data;
      if (!response.ok || !analysis) throw new Error(friendlyRouteError(response.status));
      if (!controller.signal.aborted) onTrip(analysis);
    } catch (caught) {
      if (controller.signal.aborted) return;
      const timedOut = caught instanceof DOMException
        && (caught.name === "TimeoutError" || caught.name === "AbortError");
      setError(timedOut
        ? "The route check took too long. Check your connection and try again."
        : caught instanceof Error ? caught.message : "SafeGo couldn’t check this route right now.");
    } finally {
      activeRequest.current = null;
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSuggestions([]);

    if (!hasDestination) {
      const location = findLocation(locations, stops[0]);
      if (location) {
        onLocation(location);
        return;
      }
      // If single point is not in predefined database, analyze with self as destination or prompt for second point
      if (savedStops[0]?.coordinates) {
        // Automatically add destination to form route
        addDestination();
        return;
      }
      // Try resolving single location
      setError("Add a destination to plan a route from this location.");
      return;
    }

    await analyzeRoute(stops[0], stops[1]);
  }

  function addDestination() {
    setStops((current) => current.length === 1 ? [...current, account?.home ?? ""] : current);
    setSavedStops((current) => current.length === 1 ? [...current, account?.homePlace ?? null] : current);
    setError("");
  }

  function removeDestination() {
    setStops((current) => [current[0]]);
    setSavedStops((current) => [current[0]]);
    setError("");
  }

  return (
    <form className="trip-planner" onSubmit={submit} onBlur={(e) => {
      if (!e.currentTarget.contains(e.relatedTarget)) {
        setSuggestions([]);
        setActiveInputIndex(null);
      }
    }}>
      {stops.map((stop, index) => (
        <div className="trip-stop" key={index}>
          {index > 0 && (
            <div className="flex items-center justify-between my-1 pl-3.5 pr-1">
              <div className="trip-connector !m-0 !h-4" aria-hidden="true" />
              <button
                type="button"
                className="text-[11px] text-ink-soft hover:text-brand-ink hover:bg-brand-soft/50 px-2 py-0.5 rounded transition-colors flex items-center gap-1 font-semibold"
                title="Swap origin and destination"
                onClick={() => {
                  setStops(([a, b]) => [b ?? "", a ?? ""]);
                  setSavedStops(([a, b]) => [b ?? null, a ?? null]);
                }}
              >
                <span className="text-sm leading-none">⇅</span> Swap
              </button>
            </div>
          )}
          <div className="trip-input-row">
            <span className={`trip-point trip-point-${index === 0 ? "a" : "b"}`}>{String.fromCharCode(65 + index)}</span>
            <div className="trip-field relative">
              <label htmlFor={`trip-stop-${index}`}>
                {hasDestination ? (index === 0 ? "Starting point" : "Destination") : "Location or road"}
              </label>
              <input
                id={`trip-stop-${index}`}
                value={stop}
                onChange={(event) => updateStop(index, event.target.value)}
                onFocus={() => {
                  setActiveInputIndex(index);
                  if (!savedStops[index] && stop.trim().length >= 2) searchPlaces(stop);
                }}
                placeholder={index === 0 ? "e.g. EDSA, España Blvd, or Cebu IT Park" : "Where are you going?"}
                autoComplete="off"
                disabled={loading}
                required
                maxLength={160}
                autoFocus={index === 1 && !initialDestination}
              />
              {activeInputIndex === index && (suggestions.length > 0 || loadingSuggestions) && (
                <ul className="place-results absolute left-0 right-0 top-full shadow-lg z-50 bg-panel border border-hairline rounded-box max-h-56 overflow-auto">
                  {loadingSuggestions && suggestions.length === 0 && (
                    <li className="place-empty">Searching OpenStreetMap…</li>
                  )}
                  {suggestions.map((item, sugIdx) => (
                    <li key={`${item.label}-${sugIdx}`}>
                      <button
                        type="button"
                        className="place-option"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          pickSuggestion(index, item);
                        }}
                      >
                        <span className="place-option-name">{item.label}</span>
                        <span className="place-option-meta">{item.detail}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {index > 0 && (
              <button className="remove-trip-stop" type="button" onClick={removeDestination} disabled={loading} aria-label="Remove destination">×</button>
            )}
          </div>
        </div>
      ))}
      {!hasDestination && (
        <button className="add-trip-stop" type="button" onClick={addDestination} disabled={loading}>
          <span aria-hidden="true">+</span> Add destination
        </button>
      )}
      {previewInfo && (
        <div className="mt-3 rounded-box border border-brand/25 bg-brand-soft/60 px-3 py-2 text-[12px] text-ink">
          <strong>{previewInfo.distanceKm} km</strong> · about {previewInfo.durationMin} min by car
          {previewInfo.roadNames.length > 0 && (
            <span className="block text-[11px] text-ink-soft">via {previewInfo.roadNames.join(", ")}</span>
          )}
        </div>
      )}
      <div className="trip-actions">
        <button className="submit-btn" type="submit" disabled={loading}>
          {loading ? "Checking…" : hasDestination ? "Check this route" : "Check this area"}
        </button>
      </div>
      {error && <div className="trip-error" role="alert">{error}</div>}
      <p className="trip-attribution">Road and map data © OpenStreetMap contributors.</p>
    </form>
  );
}
