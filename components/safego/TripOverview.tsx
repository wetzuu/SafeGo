import { riskGradient } from "@/lib/safego/risk-model";
import type { ScreenKey } from "@/lib/safego/types";
import type { TripAnalysis } from "@/lib/trips/types";
import { OverviewContextPanel } from "./OverviewContextPanel";
import { RiskGauge } from "./RiskGauge";

export function TripOverview({ trip, navigate }: { trip: TripAnalysis; navigate: (screen: ScreenKey) => void }) {
  const riskiest = Array.from(
    new Map(
      [...trip.segments]
        .sort((first, second) => second.riskScore - first.riskScore)
        .map((segment) => [segment.basisLocationId, segment]),
    ).values(),
  ).slice(0, 3);
  const contextLocation = trip.corridorLocations.reduce(
    (highest, location) => location.risk.percentage > highest.risk.percentage ? location : highest,
    trip.corridorLocations[0],
  );

  return (
    <section className="page">
      <div className="page-head"><div className="page-eyebrow">Route overview</div><h1 className="page-title">{trip.origin.label} → {trip.destination.label}</h1><p className="page-sub">Safety conditions along the route · live modeled weather plus the latest available SafeGo corridor signals</p></div>
      <div className={`risk-hero risk-${trip.riskKey}`}><div className="risk-hero-top"><div><div className="risk-hero-q">Estimated risk along this route</div><div className="risk-level-row"><div className="risk-level-name">{trip.riskName}</div><span className={`pill ${trip.riskKey}`}><span className="dot" />{trip.overallRiskScore}/100</span></div><p className="risk-hero-why">SafeGo found a road route and compared its segments with nearby calculated risk points. Review the colored map before leaving.</p>{trip.safetyRule && <div className="calculation-rule route-rule">{trip.safetyRule}</div>}</div><div className="gauge-wrap"><RiskGauge score={trip.overallRiskScore} /></div></div></div>
      {contextLocation && <OverviewContextPanel location={contextLocation} trip={trip} onOpenMap={() => navigate("map")} onViewConditions={() => navigate("conditions")} />}
      <div className="trip-stat-grid"><div className="card trip-stat"><span>Corridor signals</span><strong>{trip.corridorLocations.length}</strong></div><div className="card trip-stat"><span>Risk sections</span><strong>{trip.segments.length}</strong></div><div className="card trip-stat"><span>Reported hazards</span><strong>{trip.hazards.length}</strong></div><div className="card trip-stat"><span>Official advisories</span><strong>{trip.advisories.length}</strong></div></div>
      <div className="section-title">Risk hotspots <button className="view-all" type="button" onClick={() => navigate("map")}>See colored route</button></div>
      <div className="route-hotspots">{riskiest.map((segment) => <article className="card route-hotspot" key={segment.basisLocationId}><span className="route-hotspot-color" style={{ background: riskGradient(segment.riskScore) }} /><div><strong>{segment.basisLocationName}</strong><p>{segment.riskScore}/100 · closest available SafeGo risk signal for this route section</p></div></article>)}</div>
      {trip.roadNames.length > 0 && <div className="card route-roads"><strong>Roads on the generated route</strong><p>{trip.roadNames.join(" · ")}</p></div>}
      <div className="route-coverage-note"><strong>Approximate coverage:</strong> {trip.coverageNote}</div>
    </section>
  );
}
