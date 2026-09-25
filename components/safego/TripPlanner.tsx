"use client";

import { useEffect, useRef, useState } from "react";
import type { SafeGoLocation } from "@/lib/safego/types";
import type { TripAnalysis } from "@/lib/trips/types";
import { isAreaDashboardLocation } from "@/lib/trips/pilot";

interface TripEnvelope {
  data?: TripAnalysis;
  error?: { message?: string };
}

function friendlyRouteError(status: number) {
  if (status === 400) return "Check both place names and try again.";
  if (status === 404) return "We couldn’t find a road route between those places. Try nearby landmarks or the demo trip.";
  if (status === 422) return "SafeGo cannot check that trip yet. Try one of the supported areas or the demo trip.";
  return "SafeGo couldn’t check this route right now. Try again, or open the demo trip.";
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
}: {
  locations: SafeGoLocation[];
  onLocation: (location: SafeGoLocation) => void;
  onTrip: (trip: TripAnalysis) => void;
}) {
  const [stops, setStops] = useState([""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preferSavedDemo, setPreferSavedDemo] = useState(false);
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => () => activeRequest.current?.abort(), []);

  const hasDestination = stops.length === 2;

  function updateStop(index: number, value: string) {
    setStops((current) => current.map((stop, stopIndex) =>
      stopIndex === index ? value : stop,
    ));
    setPreferSavedDemo(false);
    setError("");
  }

  async function analyzeRoute(origin: string, destination: string, useSavedDemo: boolean) {
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
          preferSavedDemo: useSavedDemo,
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

    if (!hasDestination) {
      const location = findLocation(locations.filter(isAreaDashboardLocation), stops[0]);
      if (!location) {
        setError("Choose one of the supported areas shown below.");
        return;
      }
      onLocation(location);
      return;
    }

    await analyzeRoute(stops[0], stops[1], preferSavedDemo);
  }

  function addDestination() {
    setStops((current) => current.length === 1 ? [...current, ""] : current);
    setPreferSavedDemo(false);
    setError("");
  }

  function removeDestination() {
    setStops((current) => [current[0]]);
    setPreferSavedDemo(false);
    setError("");
  }

  async function runExample() {
    const origin = "España Blvd., Sampaloc";
    const destination = "Lerma St., Sampaloc";
    setStops([origin, destination]);
    setPreferSavedDemo(true);
    await analyzeRoute(origin, destination, true);
  }

  return (
    <form className="trip-planner" onSubmit={submit}>
      <p className="demo-scope"><strong>Currently supported:</strong> España, Lerma, Quiapo, Mapúa Makati, and Pasig.</p>
      <datalist id="safego-locations">
        {locations.filter(isAreaDashboardLocation).map((location) => <option key={location.id} value={location.name} />)}
      </datalist>
      {stops.map((stop, index) => (
        <div className="trip-stop" key={index}>
          {index > 0 && <div className="trip-connector" aria-hidden="true" />}
          <div className="trip-input-row">
            <span className={`trip-point trip-point-${index === 0 ? "a" : "b"}`}>{String.fromCharCode(65 + index)}</span>
            <div className="trip-field">
              <label htmlFor={`trip-stop-${index}`}>
                {hasDestination ? (index === 0 ? "Starting point" : "Destination") : "Location"}
              </label>
              <input
                id={`trip-stop-${index}`}
                value={stop}
                onChange={(event) => updateStop(index, event.target.value)}
                list="safego-locations"
                placeholder={index === 0 ? "Search a SafeGo location" : "Where are you going?"}
                autoComplete="off"
                disabled={loading}
                required
                maxLength={160}
                autoFocus={index === 1}
              />
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
      <div className="trip-actions">
        <button className="submit-btn" type="submit" disabled={loading}>
          {loading ? "Checking your route…" : hasDestination ? "Check my trip" : "Check this area"}
        </button>
        <button className="example-trip" type="button" onClick={() => void runExample()} disabled={loading}>{loading ? "Opening example…" : "Try an example trip"}</button>
      </div>
      {error && <div className="trip-error" role="alert">{error}</div>}
      <p className="trip-mode-help">
        {hasDestination
          ? "SafeGo checks the roads between A and B."
          : "Check one area, or add a destination for a route."}
      </p>
      <p className="trip-attribution">Map and place information © OpenStreetMap contributors.</p>
    </form>
  );
}
