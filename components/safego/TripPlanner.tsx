"use client";

import { useState } from "react";
import type { SafeGoLocation } from "@/lib/safego/types";
import type { TripAnalysis } from "@/lib/trips/types";

interface TripEnvelope {
  data?: TripAnalysis;
  error?: { message?: string };
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
  const hasDestination = stops.length === 2;

  function updateStop(index: number, value: string) {
    setStops((current) => current.map((stop, stopIndex) =>
      stopIndex === index ? value : stop,
    ));
    setError("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (!hasDestination) {
      const location = findLocation(locations, stops[0]);
      if (!location) {
        setError("Choose one of the available SafeGo locations to view its risk dashboard.");
        return;
      }
      onLocation(location);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/trips/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin: stops[0], destination: stops[1] }),
      });
      const envelope = (await response.json()) as TripEnvelope;
      if (!response.ok || !envelope.data) {
        throw new Error(envelope.error?.message || "The route could not be analyzed.");
      }
      onTrip(envelope.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The route could not be analyzed.");
    } finally {
      setLoading(false);
    }
  }

  function addDestination() {
    setStops((current) => current.length === 1 ? [...current, ""] : current);
    setError("");
  }

  function removeDestination() {
    setStops((current) => [current[0]]);
    setError("");
  }

  function useExample() {
    setStops(["Buting, Pasig City", "Mapua Makati Campus"]);
    setError("");
  }

  return (
    <form className="trip-planner" onSubmit={submit}>
      <datalist id="safego-locations">
        {locations.map((location) => <option key={location.id} value={location.name} />)}
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
                required
                maxLength={160}
                autoFocus={index === 1}
              />
            </div>
            {index > 0 && (
              <button className="remove-trip-stop" type="button" onClick={removeDestination} aria-label="Remove destination">×</button>
            )}
          </div>
        </div>
      ))}
      {!hasDestination && (
        <button className="add-trip-stop" type="button" onClick={addDestination}>
          <span aria-hidden="true">+</span> Add destination
        </button>
      )}
      <div className="trip-actions">
        <button className="submit-btn" type="submit" disabled={loading}>
          {loading ? "Finding and analyzing route…" : hasDestination ? "Analyze my trip" : "Check this location"}
        </button>
        <button className="example-trip" type="button" onClick={useExample}>Use example trip</button>
      </div>
      {error && <div className="trip-error" role="alert">{error}</div>}
      <p className="trip-mode-help">
        {hasDestination
          ? "SafeGo will analyze the road route between A and B."
          : "Check one covered area, or add a destination to analyze a route."}
      </p>
      <p className="trip-attribution">Location lookup © OpenStreetMap contributors. Search runs only when you submit—not while typing.</p>
    </form>
  );
}
