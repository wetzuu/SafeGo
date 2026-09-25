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
      : "SafeGo is showing its saved example because the latest road route was unavailable."}</span>
  </div>;
}

export function TripCoverage({ trip }: { trip: TripAnalysis }) {
  const { coverage } = trip;
  const hazardBand = knownHazardBand(trip);
  return <div className="card card-pad trip-coverage" aria-label="How much of the route SafeGo can check">
    <h2>{coverage.status === "insufficient" ? "SafeGo can’t rate the whole trip" : "How much of this route SafeGo can check"}</h2>
    {trip.routingSource === "saved-demo" && <p className="trip-routing-note"><strong>Example route</strong> · the latest road route was unavailable, so SafeGo used its saved example.</p>}
    <p><strong>SafeGo has information for {coverage.coveredPercent}% of this route.</strong></p>
    <meter min={0} max={100} value={coverage.coveredPercent} aria-label="Percentage of route covered" />
    <p>Gray sections have insufficient information. They are not rated low risk. {coverage.unknownMeters > 0 ? "Check current local road conditions for these gaps before deciding to travel." : "A low score is not a guarantee that a road is safe."}</p>
    {coverage.status === "insufficient" && hazardBand && <p className="calculation-rule"><strong>{hazardBand} risk appears in the covered sections.</strong> A missing overall rating does not remove that warning. Review those sections on the map.</p>}
    <details><summary>What information was available?</summary>
      <p>SafeGo only rates route sections near supported areas. A trip needs information for most of its route before SafeGo shows one overall level.</p>
      <p>Checked {new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(trip.generatedAt))}. Check the trip again to refresh it.</p>
      {trip.routingSource === "simulation" ? <p>This is a practice scenario and does not use current conditions.</p> : <>{trip.routingSource === "saved-demo" && <p>The road shown is a saved example because the latest route was unavailable.</p>}<ul>{["open-meteo", "official-advisories", "flood-road"].map((key) => {
        const source = trip.sources.find((item) => item.key === key);
        const label = key === "open-meteo" ? "Weather estimate" : key === "flood-road" ? "Flood and road observations" : "Official announcements";
        return <li key={key}><strong>{label}:</strong> {source?.status === "active" ? "current information included" : source?.status === "degraded" ? "current information unavailable; saved information shown" : "saved information shown"}.</li>;
      })}</ul></>}
      <p>Some school and community information may be part of the demo. Always confirm important information with an official source.</p>
    </details>
  </div>;
}
