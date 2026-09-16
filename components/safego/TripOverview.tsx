import type { ScreenKey } from "@/lib/safego/types";
import type { TripAnalysis } from "@/lib/trips/types";
import { OverviewContextPanel } from "./OverviewContextPanel";
import { RiskGauge } from "./RiskGauge";
import { TripDataNotice } from "./TripCoverage";
import { NearbyUniversities } from "./NearbyUniversities";

export function TripOverview({ trip, navigate }: { trip: TripAnalysis; navigate: (screen: ScreenKey) => void }) {
  const riskiest = trip.corridorLocations.slice().sort((a, b) => b.risk.percentage - a.risk.percentage).slice(0, 3);
  const contextLocation = riskiest[0];
  const universities = trip.corridorLocations.flatMap((location) => location.universities);
  return <section className="page">
    <div className="page-head"><div className="page-eyebrow">Route overview</div><h1 className="page-title">{trip.origin.label} → {trip.destination.label}</h1><p className="page-sub">Conditions reported near this route</p></div>
    <div className={`risk-hero risk-${trip.riskKey}`}><div className="risk-hero-top"><div>
      <div className="risk-hero-q">Estimated risk along this route</div>
      <div className="risk-level-row"><div className="risk-level-name">{trip.riskName}</div>{trip.overallRiskScore !== null && <span className={`pill ${trip.riskKey}`}><span className="dot" />{trip.overallRiskScore}/100</span>}</div>
      <p className="risk-hero-why">{trip.overallRiskScore === null ? "There is not enough information to rate the whole route." : "Check current official announcements before deciding to travel."}</p>
      {trip.safetyRule && <div className="calculation-rule route-rule">{trip.safetyRule}</div>}
    </div>{trip.overallRiskScore !== null && <div className="gauge-wrap"><RiskGauge score={trip.overallRiskScore} /></div>}</div></div>
    <TripDataNotice trip={trip} />
    <OverviewContextPanel location={contextLocation} trip={trip} onOpenMap={() => navigate("map")} onViewConditions={() => navigate("conditions")} />
    <NearbyUniversities universities={universities} routeMode />
    {trip.roadNames.length > 0 && <div className="card route-roads"><strong>Roads on this route</strong><p>{trip.roadNames.join(", ")}</p></div>}
    <p className="overview-safety-note">SafeGo does not replace government, school, or emergency announcements.</p>
  </section>;
}
