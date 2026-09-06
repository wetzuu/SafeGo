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
import { Brand } from "./Brand";
import { Icon } from "./Icon";
import { RiskGauge } from "./RiskGauge";
import { RiskMap } from "./RiskMap";

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

function searchLocations(locations: SafeGoLocation[], query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return locations;

  return locations.filter((location) =>
    [location.name, location.city, ...location.aliases]
      .join(" ")
      .toLocaleLowerCase()
      .includes(normalizedQuery),
  );
}

function Pill({ location, text }: { location: SafeGoLocation; text: string }) {
  return <span className={`pill ${location.risk.key}`}><span className="dot" />{text}</span>;
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

function LocationSearch({ locations, value, onSelect, compact = false }: { locations: SafeGoLocation[]; value: string; onSelect: (location: SafeGoLocation) => void; compact?: boolean }) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const results = searchLocations(locations, query);

  function choose(location: SafeGoLocation) {
    setQuery(location.name);
    setOpen(false);
    onSelect(location);
  }

  return (
    <div className={compact ? "location-bar" : "search-box"}>
      <label className="sr-only" htmlFor={compact ? "location-search-bar" : "location-search"}>{compact ? "Change location" : "Location"}</label>
      <input id={compact ? "location-search-bar" : "location-search"} value={query} type="text" placeholder={compact ? "Search another area" : "Search a street, barangay, or campus"} autoComplete="off" onFocus={() => setOpen(true)} onBlur={() => window.setTimeout(() => setOpen(false), 120)} onChange={(event) => { setQuery(event.target.value); setOpen(true); }} onKeyDown={(event) => { if (event.key === "Enter" && results[0]) { event.preventDefault(); choose(results[0]); } }} />
      {open && (
        <ul className="place-results">
          {results.length ? results.map((location) => (
            <li key={location.id}><button type="button" className="place-option" onMouseDown={(event) => event.preventDefault()} onClick={() => choose(location)}><span className="place-option-name">{location.name}</span><span className="place-option-meta">{location.city}</span></button></li>
          )) : <li className="place-empty">No matching area in the current dataset.</li>}
        </ul>
      )}
    </div>
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

function Overview({ location, navigate }: { location: SafeGoLocation; navigate: (screen: ScreenKey) => void }) {
  return <section className="page"><PageHeader eyebrow="Overview" title={location.name} subtitle={`${location.city} · informational snapshot, not an official suspension notice`} />
    <div className={`risk-hero risk-${location.risk.key}`}><div className="risk-hero-top"><div><div className="risk-hero-q">Current travel risk for this area</div><div className="risk-level-row"><div className="risk-level-name">{location.risk.name}</div><Pill location={location} text={location.risk.rank} /></div><p className="risk-hero-why">{location.risk.summary}</p><div className="risk-hero-updated"><span className="mono">Last updated {location.updated}</span></div></div><div className="gauge-wrap"><RiskGauge score={location.risk.percentage} /></div></div></div>
    <div className="stat-row">{location.stats.map((stat) => <div className="card stat-card" key={stat.label}><div className="label">{stat.label}</div><div className="value-row"><div className="value">{stat.value}</div><div className={`icon-badge ${stat.tone}`}><Icon name={stat.icon} /></div></div><div className="sub">{stat.detail}</div></div>)}</div>
    <div className="section-title">Latest advisories <button type="button" className="view-all" onClick={() => navigate("alerts")}>View all</button></div><Advisories items={location.advisories.slice(0, 3)} />
    <div className="section-title">Community reports <button type="button" className="view-all" onClick={() => navigate("reports")}>View all</button></div><Reports items={location.reports} />
  </section>;
}

function RiskFactors({ location }: { location: SafeGoLocation }) {
  return <section className="page"><PageHeader eyebrow="Risk factors" title="How this rating was estimated" subtitle={`${location.name} · ${location.risk.name.toLocaleLowerCase()}`} />
    <div className="card mb-[22px]"><div className="gauge-lg-wrap"><RiskGauge score={location.risk.percentage} size={190} /><div className="risk-level-name md">{location.risk.name}</div><p className="gauge-caption">{location.risk.summary}</p><div className="risk-hero-updated"><span className="mono">Last updated {location.updated}</span></div></div></div>
    <div className="section-title">Contributing factors</div>
    <div>{location.factors.map((factor) => <article className="card factor-card" key={factor.name}><div className={`factor-icon ${factor.tone}`}><Icon name={factor.icon} /></div><div className="factor-body"><div className="factor-top"><div className="factor-name">{factor.name}</div><span className={`pill ${factor.pill}`}><span className="dot" />{factor.pillText} · {factor.score}/100</span></div><p className="factor-desc">{factor.description}</p><div className="meter"><div className="meter-fill" style={{ width: `${factor.score}%`, background: riskGradient(factor.score) }} /></div></div></article>)}</div>
    <div className="section-title">How the score is calculated</div>
    <div className="card card-pad mb-[22px]"><div className="calculation-intro">The overall score is a weighted sum of five travel-safety signals. When connected, live modeled weather replaces only the Weather input. Model version {location.risk.modelVersion}.</div><div className="calculation-list">{location.risk.contributions.map((item) => <div className="calculation-row" key={item.name}><span>{item.name}</span><span className="mono">{item.score} × {Math.round(item.weight * 100)}% = {item.points.toFixed(1)}</span></div>)}</div><div className="calculation-total"><span>Calculated risk</span><strong className="mono">{location.risk.rawScore}/100</strong></div>{location.risk.safetyRule && <div className="calculation-rule">{location.risk.safetyRule}</div>}<div className="calculation-final"><span>Final travel risk</span><strong className="mono">{location.risk.percentage}/100 · {location.risk.name}</strong></div></div>
  </section>;
}

function Conditions({ location }: { location: SafeGoLocation }) {
  return <section className="page"><PageHeader eyebrow="Conditions" title="Flood and road conditions" subtitle={location.name} /><div className="grid grid-2"><div className="card card-pad"><div className="card-head"><h3>Watched points</h3><Pill location={location} text={location.risk.status} /></div><div className="route-track">{location.points.map((point) => <div className="route-node" key={`${point.label}-${point.name}`}><div className={`route-dot ${point.kind === "end" ? "end" : point.kind === "mid" ? "mid" : ""}`}><div className="inner" /></div><div className="rn-label">{point.label}</div><div className="rn-name">{point.name}</div><div className="rn-sub">{point.detail}</div></div>)}</div><div className="mock-note">These watched points are part of the selected area’s static mock data. Use the Map view to compare locations.</div></div><div><div className="card card-pad mb-4"><div className="card-head"><h3>Flood reports</h3><span className="tag mono">Updated {location.updated}</span></div>{location.floods.map((hazard) => <div className="hazard-row" key={hazard.title}><div className={`hazard-icon ${hazard.tone ?? ""}`}><Icon name="flood" /></div><div className="hazard-body"><div className="title">{hazard.title}</div><div className="meta">{hazard.meta}</div></div></div>)}</div><div className="card card-pad"><div className="card-head"><h3>Reported hazards</h3><span className="tag mono">{location.hazards.length} listed</span></div>{location.hazards.map((hazard) => <div className="hazard-row" key={hazard.title}><div className="hazard-icon"><Icon name="alert" /></div><div className="hazard-body"><div className="title">{hazard.title}</div><div className="meta">{hazard.meta}</div></div></div>)}</div></div></div></section>;
}

function ReportPage({ location }: { location: SafeGoLocation }) {
  const [selectedType, setSelectedType] = useState(REPORT_TYPES[0]);
  return <section className="page"><PageHeader eyebrow="Reports" title="Community reports" subtitle="Anyone can submit what they see. Submissions are not saved yet." /><div className="grid grid-2"><div className="card card-pad"><div className="form-grid"><div className="form-field"><label>Report type</label><div className="type-chip-row">{REPORT_TYPES.map((type) => <button type="button" className={`type-chip${type === selectedType ? " selected" : ""}`} key={type} onClick={() => setSelectedType(type)}>{type}</button>)}</div></div><div className="form-field"><label htmlFor="report-location">Location</label><input id="report-location" type="text" defaultValue={location.name} placeholder="Street or landmark" /></div><div className="form-field"><label htmlFor="report-description">Description</label><textarea id="report-description" placeholder="Depth of water, blockage, estimated severity, etc." /></div><button className="submit-btn" type="button" onClick={() => window.alert("Report submission is not connected yet. Phase 3 currently integrates read-only live weather.")}>Submit report</button><div className="mock-note">No account is required. This form is not connected to a backend.</div></div></div><div><div className="card-head tight"><h3>Recent reports</h3><span className="tag mono">Last 24h</span></div><Reports items={location.reports} /></div></div></section>;
}

export function SafeGoApp({ initialLocations, initialBackend, initialSources }: { initialLocations: SafeGoLocation[]; initialBackend: DataBackend; initialSources: SourceStatus[] }) {
  const [locations, setLocations] = useState(initialLocations);
  const [dataBackend, setDataBackend] = useState(initialBackend);
  const [sources, setSources] = useState(initialSources);
  const [weatherUpdatedAt, setWeatherUpdatedAt] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
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

  const selectLocation = useCallback((location: SafeGoLocation) => {
    setSelectedLocation(location);
    setActiveScreen("overview");
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);
  const selectMapLocation = useCallback((location: SafeGoLocation) => {
    setSelectedLocation(location);
  }, []);
  const navigate = useCallback((screen: ScreenKey) => {
    setActiveScreen(screen);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  if (!selectedLocation) {
    return <main id="search-screen"><div className="search-panel"><div className="brandmark search-brand"><Brand /></div><h1 className="search-title">Check travel risk in an area</h1><p className="search-lead">Enter a place in Metro Manila to see weather, flood conditions, advisories, and community reports for that location.</p><DataStatus backend={dataBackend} sources={sources} refreshing={refreshing} weatherUpdatedAt={weatherUpdatedAt} onRefresh={() => void refreshDashboard()} /><LocationSearch locations={locations} value="" onSelect={selectLocation} /><div className="suggest-label">Suggested areas</div><div className="place-chips">{locations.map((location) => <button key={location.id} type="button" className="place-chip" onClick={() => selectLocation(location)}>{location.name}</button>)}</div><p className="search-disclaimer">SafeGo is informational. Live weather is modeled data; other signals may be stored mocks. It does not declare class suspensions. Follow official school and government announcements.</p></div></main>;
  }

  return <div id="app-shell" className="active"><nav className="sidenav hidden lg:flex"><button type="button" className="brandmark brand-home" onClick={() => setSelectedLocation(null)}><Brand compact /></button><Navigation activeScreen={activeScreen} onNavigate={navigate} /><button type="button" className="change-loc" onClick={() => setSelectedLocation(null)}>Change location</button></nav><div className="main-col"><div className="topbar"><button type="button" className="brandmark brand-home" onClick={() => setSelectedLocation(null)}><Brand compact /></button><Pill location={selectedLocation} text={selectedLocation.risk.name.replace(" RISK", "")} /></div><div className="dashboard-data-status"><DataStatus backend={dataBackend} sources={sources} refreshing={refreshing} weatherUpdatedAt={weatherUpdatedAt} onRefresh={() => void refreshDashboard()} /></div><LocationSearch locations={locations} key={selectedLocation.id} value={selectedLocation.name} compact onSelect={selectLocation} />
    {activeScreen === "overview" && <Overview location={selectedLocation} navigate={navigate} />}
    {activeScreen === "risk" && <RiskFactors location={selectedLocation} />}
    {activeScreen === "alerts" && <section className="page"><PageHeader eyebrow="Alerts" title="Advisories for this area" subtitle="School, government, weather, and community notices, newest first." /><Advisories items={selectedLocation.advisories} /></section>}
    {activeScreen === "map" && <RiskMap locations={locations} selectedLocation={selectedLocation} onSelectLocation={selectMapLocation} onViewDashboard={() => navigate("overview")} />}
    {activeScreen === "conditions" && <Conditions location={selectedLocation} />}
    {activeScreen === "reports" && <ReportPage key={selectedLocation.id} location={selectedLocation} />}
  </div><nav className="bottom-tabs visible" aria-label="Primary navigation"><Navigation activeScreen={activeScreen} onNavigate={navigate} /></nav></div>;
}
