import type { TripAnalysis } from "@/lib/trips/types";

function knownHazardBand(trip: TripAnalysis) {
  return trip.segments.some((segment) => segment.riskKey === "crit")
    ? "Critical"
    : trip.segments.some((segment) => segment.riskKey === "high")
      ? "High"
      : null;
}

export function TripDataNotice({ trip }: { trip: TripAnalysis }) {
  const missingRating = trip.overallRiskScore === null;
  const savedRoute = trip.routingSource === "saved-demo";
  const hazardBand = knownHazardBand(trip);

  if (!missingRating && !savedRoute) return null;

  return <div className={`trip-data-notice${missingRating ? " warning" : ""}`} role="status">
    <strong>{missingRating ? "Some parts of this route do not have enough data." : "Using the saved demo route."}</strong>
    <span>{missingRating
      ? `${hazardBand ? `${hazardBand} risk still appears where information is available. ` : ""}Gray map sections are not rated as safe.`
      : "Live routing was unavailable or skipped for this example."}</span>
  </div>;
}

export function TripCoverage({ trip }: { trip: TripAnalysis }) {
  const { coverage } = trip;
  const hazardBand = knownHazardBand(trip);
  return <div className="card card-pad trip-coverage" aria-label="Route coverage and data quality">
    <h2>{coverage.status === "insufficient" ? "We don’t have enough coverage to rate this trip" : "Coverage estimate for this trip"}</h2>
    {trip.routingSource === "saved-demo" && <p className="trip-routing-note"><strong>Saved demo road geometry</strong> · live routing was not used for this example.</p>}
    <p><strong>{coverage.coveredPercent}% covered</strong> · at least {coverage.minimumPercent}% required for a rating.</p>
    <meter min={0} max={100} value={coverage.coveredPercent} aria-label="Percentage of route covered" />
    <p>Gray sections have insufficient information. They are not rated low risk. {coverage.unknownMeters > 0 ? "Check current local road conditions for these gaps before deciding to travel." : "A low score is not a guarantee that a road is safe."}</p>
    {coverage.status === "insufficient" && hazardBand && <p className="calculation-rule"><strong>{hazardBand} risk appears in the covered sections.</strong> A missing overall rating does not remove that warning. Review those sections on the map.</p>}
    <details><summary>Why this result? View coverage and sources</summary>
      <p>Only sections within {coverage.radiusMeters} meters of a pilot point can be scored. The rating uses the covered sections; High and Critical sections set a minimum risk band. These pilot limits and model weights still need real-world validation.</p>
      <p>Trip snapshot: {new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(trip.generatedAt))}. Analyze the trip again for a new snapshot.</p>
      {trip.routingSource === "simulation" ? <p>All inputs in this review are simulated. No live feeds or fallback observations were used.</p> : <>{trip.routingSource === "saved-demo" && <p><strong>Routing fallback:</strong> Live routing was unavailable, so this example uses saved OSRM road geometry captured on September 14, 2026. Re-analyze when the provider is available for a current route.</p>}<ul>{["open-meteo", "official-advisories", "flood-road"].map((key) => {
        const source = trip.sources.find((item) => item.key === key);
        const label = key === "open-meteo" ? "Modeled weather" : key === "flood-road" ? "Flood and road observations" : "Official announcements";
        return <li key={key}><strong>{label}:</strong> {source?.status === "active" ? "connected in this snapshot" : source?.status === "degraded" ? "unavailable; stored fallback used" : "not connected; stored fallback used"}.</li>;
      })}</ul></>}
      <p>Stored signals can include demo fixtures, including school and community information. Geographic coverage and a connected feed do not verify every underlying signal. Follow current official announcements.</p>
    </details>
  </div>;
}
