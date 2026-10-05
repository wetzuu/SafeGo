"use client";

import { useEffect, useRef, useState } from "react";
import type { SafeGoLocation } from "@/lib/safego/types";

/** A place chosen from the suggestion list, so the server can save it without searching again. */
export interface PickedPlace {
  label: string;
  detail: string;
  coordinates: [number, number];
  matchedLocationId: string | null;
}

const normalized = (value: string) => value.trim().toLocaleLowerCase();

async function searchOpenStreetMap(query: string, signal: AbortSignal): Promise<PickedPlace[]> {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=jsonv2&countrycodes=ph&limit=5&addressdetails=1`,
    { headers: { Accept: "application/json" }, signal },
  );
  if (!response.ok) throw new Error("Search service error");
  const results = (await response.json()) as Array<{ display_name: string; name?: string; lat: string; lon: string }>;
  return results.map((item) => {
    const parts = item.display_name.split(", ");
    return {
      label: item.name || parts[0],
      detail: parts.slice(item.name ? 0 : 1, 4).join(", ") || item.display_name,
      coordinates: [Number(item.lat), Number(item.lon)],
      matchedLocationId: null,
    };
  });
}

/**
 * A location field that suggests places as you type: SafeGo's own locations first, then
 * OpenStreetMap results for the Philippines. Typing after a pick clears the pick.
 */
export function PlaceInput({
  id,
  value,
  onChange,
  locations = [],
  placeholder,
  required = false,
  autoFocus = false,
}: {
  id: string;
  value: string;
  /** Called with the text and, when it came from the list, the place that was picked. */
  onChange: (value: string, picked: PickedPlace | null) => void;
  locations?: SafeGoLocation[];
  placeholder?: string;
  required?: boolean;
  autoFocus?: boolean;
}) {
  const [suggestions, setSuggestions] = useState<PickedPlace[]>([]);
  const [state, setState] = useState<"idle" | "searching" | "empty">("idle");
  const [open, setOpen] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const request = useRef<AbortController | null>(null);

  useEffect(() => () => {
    request.current?.abort();
    if (debounce.current) clearTimeout(debounce.current);
  }, []);

  function search(text: string) {
    if (debounce.current) clearTimeout(debounce.current);
    request.current?.abort();
    const query = text.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setState("idle");
      return;
    }
    setState("searching");
    debounce.current = setTimeout(async () => {
      const controller = new AbortController();
      request.current = controller;
      const local: PickedPlace[] = locations
        .filter((location) => [location.name, location.city, ...location.aliases].some((candidate) => normalized(candidate).includes(normalized(query))))
        .map((location) => ({ label: location.name, detail: `${location.city} · SafeGo location`, coordinates: location.coordinates, matchedLocationId: location.id }));
      let found = local;
      try {
        const osm = await searchOpenStreetMap(query, controller.signal);
        found = [...local, ...osm.filter((item) => !local.some((known) => normalized(known.label) === normalized(item.label)))];
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        // OpenStreetMap search is unreachable; SafeGo's own locations still work.
      }
      if (controller.signal.aborted) return;
      setSuggestions(found.slice(0, 6));
      setState(found.length ? "idle" : "empty");
    }, 350);
  }

  const listOpen = open && (suggestions.length > 0 || state !== "idle");

  return (
    <div className="relative grid" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
      <input
        id={id}
        value={value}
        onChange={(event) => { onChange(event.target.value, null); setOpen(true); search(event.target.value); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}
        placeholder={placeholder}
        required={required}
        autoFocus={autoFocus}
        maxLength={160}
        autoComplete="off"
        role="combobox"
        aria-expanded={listOpen}
        aria-controls={`${id}-suggestions`}
        aria-autocomplete="list"
      />
      {listOpen && (
        <ul id={`${id}-suggestions`} className="place-results absolute left-0 right-0 top-full z-50 max-h-56 overflow-auto rounded-box border border-hairline bg-panel shadow-lg" role="listbox">
          {suggestions.length === 0 && <li className="place-empty">{state === "searching" ? "Searching OpenStreetMap…" : "No matching place found. You can still save what you typed."}</li>}
          {suggestions.map((item, index) => (
            <li key={`${item.label}-${index}`} role="option" aria-selected="false">
              <button
                type="button"
                className="place-option"
                // Mouse down, not click, so the pick lands before the input loses focus.
                onMouseDown={(event) => { event.preventDefault(); onChange(item.label, item); setSuggestions([]); setState("idle"); setOpen(false); }}
              >
                <span className="place-option-name">{item.label}</span>
                <span className="place-option-meta">{item.detail}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
