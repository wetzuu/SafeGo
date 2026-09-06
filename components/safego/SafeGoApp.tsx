"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  DashboardSnapshot,
  DataBackend,
  SourceStatus,
} from "@/lib/data/contracts";
import { riskGradient } from "@/lib/safego/risk-model";
import type {
  Advisory,
  CommunityReport,
  SafeGoLocation,
  ScreenKey,
} from "@/lib/safego/types";
import type { TripAnalysis } from "@/lib/trips/types";
import { Brand } from "./Brand";
import { Icon } from "./Icon";
import { RiskGauge } from "./RiskGauge";
import { RiskMap } from "./RiskMap";
import { TripOverview } from "./TripOverview";
import { TripPlanner } from "./TripPlanner";

const NAV_ITEMS: Array<{
  key: ScreenKey;
  label: string;
  icon: "overview" | "risk" | "alert" | "map" | "reports";
}> = [
  { key: "overview", label: "Overview", icon: "overview" },
  { key: "risk", label: "Risk factors", icon: "risk" },
  { key: "alerts", label: "Alerts", icon: "alert" },
  { key: "map", label: "Map", icon: "map" },
  { key: "conditions", label: "Conditions", icon: "reports" },
  { key: "reports", label: "Reports", icon: "reports" },
];

const REPORT_TYPES = [
  "Flooding",
  "Road Hazard",
  "Transport Disruption",
  "Power / Signal Outage",
  "Other",
];

interface DashboardEnvelope {
  data: DashboardSnapshot;
  meta: { backend: DataBackend; generatedAt: string };
}

function Navigation({ activeScreen, onNavigate }: { activeScreen: ScreenKey; onNavigate: (screen: ScreenKey) => void }) {
  return (
    <ul className="nav-list">
      {NAV_ITEMS.map((item) => (
        <li key={item.key}>
          <button type="button" className={`nav-item${activeScreen === item.key ? " active" : ""}`} onClick={() => onNavigate(item.key)} aria-current={activeScreen === item.key ? "page" : undefined}>
            <Icon name={item.icon} /><span>{item.label}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function DataStatus({ backend, sources, refreshing, weatherUpdatedAt, onRefresh }: { backend: DataBackend; sources: SourceStatus[]; refreshing: boolean; weatherUpdatedAt: string | null; onRefresh: () => void }) {
  const weather = sources.find((source) => source.key === "open-meteo");
  const live = weather?.status === "active";
  const degraded = weather?.status === "degraded";
  const detail = live
    ? `Live modeled weather · ${backend === "mock" ? "other signals are mock" : "other signals from database"}`
    : degraded
      ? "Weather feed unavailable · stored signals shown"
      : "Stored SafeGo signals · live weather disabled";
  const updated = weatherUpdatedAt
    ? new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" }).format(new Date(weatherUpdatedAt))
    : null;

  return <div className={`data-status${live ? " live" : degraded ? " degraded" : ""}`} role="status"><span className="data-status-dot" /><span className="data-status-copy"><strong>{live ? "Live weather connected" : degraded ? "Using stored weather" : "Offline data mode"}</strong><span>{detail}{updated ? ` · refreshed ${updated}` : ""}</span></span><button type="button" onClick={onRefresh} disabled={refreshing}>{refreshing ? "Refreshing…" : "Refresh"}</button></div>;
}

function Advisories({ items }: { items: Advisory[] }) {
  if (!items.length) return <p className="empty-note">No advisories for this area in the current dataset.</p>;
  return <>{items.map((item) => <article className="adv-item" key={`${item.source}-${item.title}`}><div className={`source-strip strip-${item.source}`} /><div className="adv-body"><div className="adv-top"><span className={`src-tag src-${item.source}`}>{item.label}</span><span className="adv-title inline">{item.title}</span></div><div className="adv-desc">{item.description}</div></div><time className="adv-time mono">{item.time}</time></article>)}</>;
}

function Reports({ items }: { items: CommunityReport[] }) {
  if (!items.length) return <p className="empty-note">No community reports in the current dataset.</p>;
  return <>{items.map((item) => <article className="report-row" key={`${item.type}-${item.title}`}><div className="rtype"><Icon name={item.type === "Flooding" ? "flood" : "alert"} /></div><div className="report-main"><div className="title">{item.title}</div><div className="meta">{item.meta}</div></div><span className={`status-chip status-${item.status}`}>{item.statusLabel}</span></article>)}</>;
}

function PageHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return <div className="page-head"><div className="page-eyebrow">{eyebrow}</div><h1 className="page-title">{title}</h1><p className="page-sub">{subtitle}</p></div>;
}

function TripRiskFactors({ trip }: { trip: TripAnalysis }) {
  return <section className="page"><PageHeader eyebrow="Route risk" title="How this trip was scored" subtitle={`${trip.origin.label} → ${trip.destination.label}`} />
    <div className="card card-pad mb-[22px]"><div className="gauge-lg-wrap"><RiskGauge score={trip.overallRiskScore} size={190} /><div className="risk-level-name md">{trip.riskName}</div><p className="gauge-caption">The route’s {trip.rawRiskScore}/100 distance-weighted score is based on the nearest calculated SafeGo point for each colored segment.</p>{trip.safetyRule && <div className="calculation-rule route-rule">{trip.safetyRule}</div>}</div></div>
    <div className="section-title">Risk points covering this route</div>
    <div>{trip.corridorLocations.map((location) => <article className="card factor-card route-factor-card" key={location.id}><div className="route-location-score" style={{ background: riskGradient(location.risk.percentage) }}>{location.risk.percentage}</div><div className="factor-body"><div className="factor-top"><div className="factor-name">{location.name}</div><span className={`pill ${location.risk.key}`}><span className="dot" />{location.risk.name}</span></div><p className="factor-desc">{location.risk.summary}</p><p className="route-weather-detail"><strong>Weather:</strong> {location.factors.find((factor) => factor.name === "Weather")?.description}</p><div className="route-factor-pills">{location.factors.map((factor) => <span key={factor.name}>{factor.name}: <strong>{factor.score}</strong></span>)}</div></div></article>)}</div>
    <div className="route-coverage-note"><strong>Method:</strong> {trip.coverageNote} These colors are a coverage estimate—not sensor readings for every road.</div>
  </section>;
}

function TripConditions({ trip }: { trip: TripAnalysis }) {
  return <section className="page"><PageHeader eyebrow="Route conditions" title="Hazards and reports near your trip" subtitle="Aggregated from SafeGo locations within approximately 3 km of the route." /><div className="grid grid-2"><div className="card card-pad"><div className="card-head"><h3>Reported hazards</h3><span className="tag mono">{trip.hazards.length} listed</span></div>{trip.hazards.length ? trip.hazards.map((hazard) => <div className="hazard-row" key={`${hazard.title}-${hazard.meta}`}><div className="hazard-icon"><Icon name="alert" /></div><div className="hazard-body"><div className="title">{hazard.title}</div><div className="meta">{hazard.meta}</div></div></div>) : <p className="empty-note">No hazards are listed near the current route.</p>}</div><div><div className="card-head tight"><h3>Community observations</h3><span className="tag mono">Route corridor</span></div><Reports items={trip.reports} /></div></div><div className="route-coverage-note"><strong>Important:</strong> A missing report does not prove a road is safe. Check official announcements and current road conditions.</div></section>;
}

function ReportPage({ location, items }: { location: SafeGoLocation; items: CommunityReport[] }) {
  const [selectedType, setSelectedType] = useState(REPORT_TYPES[0]);
  return <section className="page"><PageHeader eyebrow="Reports" title="Community reports near this trip" subtitle="Anyone can submit what they see. Submissions are not saved yet." /><div className="grid grid-2"><div className="card card-pad"><div className="form-grid"><div className="form-field"><label>Report type</label><div className="type-chip-row">{REPORT_TYPES.map((type) => <button type="button" className={`type-chip${type === selectedType ? " selected" : ""}`} key={type} onClick={() => setSelectedType(type)}>{type}</button>)}</div></div><div className="form-field"><label htmlFor="report-location">Location</label><input id="report-location" type="text" defaultValue={location.name} placeholder="Street or landmark" /></div><div className="form-field"><label htmlFor="report-description">Description</label><textarea id="report-description" placeholder="Depth of water, blockage, estimated severity, etc." /></div><button className="submit-btn" type="button" onClick={() => window.alert("Report submission is not connected yet. Phase 3 currently integrates read-only live weather and route analysis.")}>Submit report</button><div className="mock-note">No account is required. This form is not connected to a backend.</div></div></div><div><div className="card-head tight"><h3>Recent corridor reports</h3><span className="tag mono">Available data</span></div><Reports items={items} /></div></div></section>;
}

export function SafeGoApp({ initialLocations, initialBackend, initialSources }: { initialLocations: SafeGoLocation[]; initialBackend: DataBackend; initialSources: SourceStatus[] }) {
  const [locations, setLocations] = useState(initialLocations);
  const [dataBackend, setDataBackend] = useState(initialBackend);
  const [sources, setSources] = useState(initialSources);
  const [weatherUpdatedAt, setWeatherUpdatedAt] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [trip, setTrip] = useState<TripAnalysis | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<SafeGoLocation | null>(null);
  const [activeScreen, setActiveScreen] = useState<ScreenKey>("overview");

  const refreshDashboard = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      if (!response.ok) throw new Error(`Dashboard returned ${response.status}`);
      const envelope = (await response.json()) as DashboardEnvelope;
      setLocations(envelope.data.locations);
      setDataBackend(envelope.meta.backend);
      setSources(envelope.data.sources);
      setWeatherUpdatedAt(envelope.data.weatherUpdatedAt);
      setSelectedLocation((current) => current
        ? envelope.data.locations.find((location) => location.id === current.id) ?? current
        : current);
    } catch {
      setSources((current) => [
        ...current.filter((source) => source.key !== "open-meteo"),
        { key: "open-meteo", name: "Open-Meteo forecast models", kind: "weather", status: "degraded", lastSuccessAt: null, lastFailureAt: new Date().toISOString(), errorMessage: "Dashboard refresh failed." },
      ]);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refreshDashboard(), 0);
    const refreshTimer = window.setInterval(() => void refreshDashboard(), 5 * 60 * 1000);
    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(refreshTimer);
    };
  }, [refreshDashboard]);

  const selectTrip = useCallback((analysis: TripAnalysis) => {
    const destinationRiskId =
      analysis.destination.matchedLocationId ??
      analysis.segments.at(-1)?.basisLocationId;
    const supportingLocation =
      locations.find((location) => location.id === destinationRiskId) ??
      analysis.corridorLocations[0] ??
      locations[0];
    setTrip(analysis);
    setSelectedLocation(supportingLocation);
    setActiveScreen("overview");
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [locations]);
  const selectMapLocation = useCallback((location: SafeGoLocation) => {
    setSelectedLocation(location);
  }, []);
  const navigate = useCallback((screen: ScreenKey) => {
    setActiveScreen(screen);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);
  const startNewTrip = useCallback(() => {
    setTrip(null);
    setSelectedLocation(null);
    setActiveScreen("overview");
  }, []);

  if (!selectedLocation || !trip) {
    return <main id="search-screen"><div className="search-panel trip-search-panel"><div className="brandmark search-brand"><Brand /></div><h1 className="search-title">How risky is your trip?</h1><p className="search-lead">Enter where you’re coming from and where you’re going. SafeGo will find a driving route and explain the risks along it.</p><DataStatus backend={dataBackend} sources={sources} refreshing={refreshing} weatherUpdatedAt={weatherUpdatedAt} onRefresh={() => void refreshDashboard()} /><TripPlanner locations={locations} onTrip={selectTrip} /><p className="search-disclaimer">Route colors are approximate and use nearby SafeGo risk points. Live weather is modeled data; flood, school, advisory, and community signals may still be mocks. Follow official announcements.</p></div></main>;
  }

  return <div id="app-shell" className="active"><nav className="sidenav hidden lg:flex"><button type="button" className="brandmark brand-home" onClick={startNewTrip}><Brand compact /></button><Navigation activeScreen={activeScreen} onNavigate={navigate} /><button type="button" className="change-loc" onClick={startNewTrip}>Plan another trip</button></nav><div className="main-col"><div className="topbar"><button type="button" className="brandmark brand-home" onClick={startNewTrip}><Brand compact /></button><span className={`pill ${trip.riskKey}`}><span className="dot" />{trip.riskName.replace(" RISK", "")}</span></div><div className="dashboard-data-status"><DataStatus backend={dataBackend} sources={sources} refreshing={refreshing} weatherUpdatedAt={weatherUpdatedAt} onRefresh={() => void refreshDashboard()} /></div><div className="trip-bar"><span><strong>A</strong> {trip.origin.label}</span><span className="trip-bar-arrow">→</span><span><strong>B</strong> {trip.destination.label}</span><button type="button" onClick={startNewTrip}>Change trip</button></div>
    {activeScreen === "overview" && <TripOverview trip={trip} navigate={navigate} />}
    {activeScreen === "risk" && <TripRiskFactors trip={trip} />}
    {activeScreen === "alerts" && <section className="page"><PageHeader eyebrow="Route alerts" title="Advisories near this trip" subtitle="Notices from SafeGo coverage points near the generated route." /><Advisories items={trip.advisories} /></section>}
    {activeScreen === "map" && <RiskMap locations={locations} selectedLocation={selectedLocation} trip={trip} onSelectLocation={selectMapLocation} onViewDashboard={() => navigate("overview")} />}
    {activeScreen === "conditions" && <TripConditions trip={trip} />}
    {activeScreen === "reports" && <ReportPage key={selectedLocation.id} location={selectedLocation} items={trip.reports} />}
  </div><nav className="bottom-tabs visible" aria-label="Primary navigation"><Navigation activeScreen={activeScreen} onNavigate={navigate} /></nav></div>;
}
