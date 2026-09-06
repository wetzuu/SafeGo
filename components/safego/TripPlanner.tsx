"use client";

import { useState } from "react";
import type { SafeGoLocation } from "@/lib/safego/types";
import type { TripAnalysis } from "@/lib/trips/types";

interface TripEnvelope {
  data?: TripAnalysis;
  error?: { message?: string };
}

export function TripPlanner({
  locations,
  onTrip,
}: {
  locations: SafeGoLocation[];
  onTrip: (trip: TripAnalysis) => void;
}) {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/trips/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin, destination }),
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

  function useExample() {
    setOrigin("Buting, Pasig City");
    setDestination("Mapua Makati Campus");
    setError("");
  }

  return (
    <form className="trip-planner" onSubmit={submit}>
      <datalist id="safego-locations">
        {locations.map((location) => <option key={location.id} value={location.name} />)}
      </datalist>
      <div className="trip-input-row">
        <span className="trip-point trip-point-a">A</span>
        <div className="trip-field">
          <label htmlFor="trip-origin">Starting point</label>
          <input id="trip-origin" value={origin} onChange={(event) => setOrigin(event.target.value)} list="safego-locations" placeholder="e.g. Buting, Pasig City" autoComplete="off" required maxLength={160} />
        </div>
      </div>
      <div className="trip-connector" />
      <div className="trip-input-row">
        <span className="trip-point trip-point-b">B</span>
        <div className="trip-field">
          <label htmlFor="trip-destination">Destination</label>
          <input id="trip-destination" value={destination} onChange={(event) => setDestination(event.target.value)} list="safego-locations" placeholder="e.g. Mapúa University, Makati" autoComplete="off" required maxLength={160} />
        </div>
      </div>
      <div className="trip-actions">
        <button className="submit-btn" type="submit" disabled={loading}>{loading ? "Finding and analyzing route…" : "Analyze my trip"}</button>
        <button className="example-trip" type="button" onClick={useExample}>Use example trip</button>
      </div>
      {error && <div className="trip-error" role="alert">{error}</div>}
      <p className="trip-attribution">Location lookup © OpenStreetMap contributors. Search runs only when you submit—not while typing.</p>
    </form>
  );
}
