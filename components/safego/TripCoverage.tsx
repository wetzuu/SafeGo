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
  const hazardBand = knownHazardBand(trip);

  const estimatedPercent = trip.coverage.estimatedMeters
    ? Math.round((trip.coverage.estimatedMeters / trip.coverage.totalMeters) * 100)
    : 0;

  if (!missingRating && !estimatedPercent) return null;
  if (!missingRating) {
    return <div className="trip-data-notice" role="status">
      <strong>{estimatedPercent}% of this route is an area estimate.</strong>
      <span>No SafeGo location is nearby, so those lighter, dashed sections use live weather and PAGASA alerts only. Street flooding and road conditions are not checked there.</span>
    </div>;
  }

  return <div className={`trip-data-notice${missingRating ? " warning" : ""}`} role="status">
    <strong>Some parts of this route do not have enough data.</strong>
    <span>{`${hazardBand ? `${hazardBand} risk still appears where information is available. ` : ""}Gray map sections are not rated as safe.`}</span>
  </div>;
}

export function TripCoverage({ trip }: { trip: TripAnalysis }) {
  const { coverage } = trip;
  const hazardBand = knownHazardBand(trip);
  const areaEstimate = coverage.status === "insufficient" && trip.overallRiskScore !== null;
  return <div className="card card-pad trip-coverage" aria-label="How much of the route SafeGo can check">
    <h2>{areaEstimate ? "Area-wide estimate" : coverage.status === "insufficient" ? "SafeGo can’t rate the whole trip" : "How much of this route SafeGo can check"}</h2>
    <p><strong>SafeGo has information for {coverage.coveredPercent}% of this route.</strong></p>
    <meter min={0} max={100} value={coverage.coveredPercent} aria-label="Percentage of route covered" />
    {areaEstimate && <p className="calculation-rule">{trip.coverageNote}</p>}
    <p>Gray sections have no location-specific information. {areaEstimate ? "The Low rating comes from calm area-wide conditions, not from these sections." : "They are not rated low risk."} {coverage.unknownMeters > 0 ? "Check current local road conditions for these gaps before deciding to travel." : "A low score is not a guarantee that a road is safe."}</p>
    {coverage.status === "insufficient" && hazardBand && <p className="calculation-rule"><strong>{hazardBand} risk appears in the covered sections.</strong> A missing overall rating does not remove that warning. Review those sections on the map.</p>}
    <details><summary>What information was available?</summary>
      <p>SafeGo only rates route sections near supported areas. A trip needs information for most of its route before SafeGo shows one overall level.</p>
      <p>Checked {new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(trip.generatedAt))}. Check the trip again to refresh it.</p>
      {trip.routingSource === "simulation" ? <p>This is a practice scenario and does not use current conditions.</p> : <><ul>{["open-meteo", "official-advisories", "flood-road"].map((key) => {
        const source = trip.sources.find((item) => item.key === key);
        const label = key === "open-meteo" ? "Weather estimate" : key === "flood-road" ? "Flood and road observations" : "Official announcements";
        return <li key={key}><strong>{label}:</strong> {source?.status === "active" ? "current information included" : "current information unavailable"}.</li>;
      })}</ul></>}
      <p>University, road, and community information appears only when a current connected source provides it.</p>
    </details>
  </div>;
}
