import type { TripAnalysis } from "@/lib/trips/types";

export function TripCoverage({ trip }: { trip: TripAnalysis }) {
  const { coverage } = trip;
  const knownHazardBand = trip.segments.some((segment) => segment.riskKey === "crit")
    ? "Critical" : trip.segments.some((segment) => segment.riskKey === "high") ? "High" : null;
  return <div className="card card-pad trip-coverage" aria-label="Route coverage and data quality">
    <h2>{coverage.status === "insufficient" ? "We don’t have enough coverage to rate this trip" : "Coverage estimate for this trip"}</h2>
    <p><strong>{coverage.coveredPercent}% covered</strong> · at least {coverage.minimumPercent}% required for a rating.</p>
    <meter min={0} max={100} value={coverage.coveredPercent} aria-label="Percentage of route covered" />
    <p>Gray sections have insufficient information. They are not rated low risk. {coverage.unknownMeters > 0 ? "Check current local road conditions for these gaps before deciding to travel." : "A low score is not a guarantee that a road is safe."}</p>
    {coverage.status === "insufficient" && knownHazardBand && <p className="calculation-rule"><strong>{knownHazardBand} risk appears in the covered sections.</strong> A missing overall rating does not remove that warning. Review those sections on the map.</p>}
    <details><summary>Why this result? View coverage and sources</summary>
      <p>Only sections within {coverage.radiusMeters} meters of a pilot point can be scored. The rating uses the covered sections; High and Critical sections set a minimum risk band. These pilot limits and model weights still need real-world validation.</p>
      <p>Trip snapshot: {new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(trip.generatedAt))}. Analyze the trip again for a new snapshot.</p>
      {trip.routingSource === "simulation" ? <p>All inputs in this review are simulated. No live feeds or fallback observations were used.</p> : <ul>{["open-meteo", "official-advisories", "flood-road"].map((key) => {
        const source = trip.sources.find((item) => item.key === key);
        const label = key === "open-meteo" ? "Modeled weather" : key === "flood-road" ? "Flood and road observations" : "Official advisories";
        return <li key={key}><strong>{label}:</strong> {source?.status === "active" ? "connected in this snapshot" : source?.status === "degraded" ? "unavailable; stored fallback used" : "not connected; stored fallback used"}.</li>;
      })}</ul>}
      <p>Stored signals can include demo fixtures, including school and community information. Geographic coverage and a connected feed do not verify every underlying signal. Follow current official announcements.</p>
    </details>
  </div>;
}
