import { riskGradient } from "@/lib/safego/risk-model";
import type { ScreenKey } from "@/lib/safego/types";
import type { TripAnalysis } from "@/lib/trips/types";
import { OverviewContextPanel } from "./OverviewContextPanel";
import { RiskGauge } from "./RiskGauge";
import { TripCoverage } from "./TripCoverage";

export function TripOverview({ trip, navigate }: { trip: TripAnalysis; navigate: (screen: ScreenKey) => void }) {
  const riskiest = trip.corridorLocations.slice().sort((a, b) => b.risk.percentage - a.risk.percentage).slice(0, 3);
  const contextLocation = riskiest[0];
  return <section className="page">
    <div className="page-head"><div className="page-eyebrow">Route overview · pilot model</div><h1 className="page-title">{trip.origin.label} → {trip.destination.label}</h1><p className="page-sub">Estimated conditions from the available corridor signals</p></div>
    <div className={`risk-hero risk-${trip.riskKey}`}><div className="risk-hero-top"><div>
      <div className="risk-hero-q">Estimated risk along this route</div>
      <div className="risk-level-row"><div className="risk-level-name">{trip.riskName}</div>{trip.overallRiskScore !== null && <span className={`pill ${trip.riskKey}`}><span className="dot" />{trip.overallRiskScore}/100</span>}</div>
      <p className="risk-hero-why">{trip.overallRiskScore === null ? "The route is available, but too much of it is outside our pilot coverage. No overall score has been assigned." : "Review gaps, sources, and current official notices before deciding to travel. This estimate uses the covered sections."}</p>
      {trip.safetyRule && <div className="calculation-rule route-rule">{trip.safetyRule}</div>}
    </div>{trip.overallRiskScore !== null && <div className="gauge-wrap"><RiskGauge score={trip.overallRiskScore} /></div>}</div></div>
    <TripCoverage trip={trip} />
    {contextLocation && <OverviewContextPanel location={contextLocation} trip={trip} onOpenMap={() => navigate("map")} onViewConditions={() => navigate("conditions")} />}
    <div className="trip-stat-grid"><div className="card trip-stat"><span>Geographic coverage</span><strong>{trip.coverage.coveredPercent}%</strong></div><div className="card trip-stat"><span>Supporting points</span><strong>{trip.corridorLocations.length}</strong></div><div className="card trip-stat"><span>Listed hazards</span><strong>{trip.hazards.length}</strong></div><div className="card trip-stat"><span>Listed advisories</span><strong>{trip.advisories.length}</strong></div></div>
    <div className="section-title">Risk in covered sections <button className="view-all" type="button" onClick={() => navigate("map")}>See route and coverage gaps</button></div>
    <div className="route-hotspots">{riskiest.map((location) => <article className="card route-hotspot" key={location.id}><span className="route-hotspot-color" style={{ background: riskGradient(location.risk.percentage) }} /><div><strong>{location.name}</strong><p>{location.risk.percentage}/100 · covered sections only; unknown sections remain unscored</p></div></article>)}</div>
    {!riskiest.length && <p className="empty-note">No pilot points cover this route. Open the map to see the unscored route.</p>}
    {trip.roadNames.length > 0 && <div className="card route-roads"><strong>Roads on the generated route</strong><p>{trip.roadNames.join(" · ")}</p></div>}
    <div className="route-coverage-note">{trip.coverageNote}</div>
  </section>;
}
