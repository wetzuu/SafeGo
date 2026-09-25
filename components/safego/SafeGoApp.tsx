"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { COMMUNITY_REPORT_TYPES } from "@/lib/reports/report-input";
import type { TripAnalysis } from "@/lib/trips/types";
import { assessTrip } from "@/lib/trips/trip-assessment";
import { Brand } from "./Brand";
import { Icon } from "./Icon";
import { OverviewContextPanel } from "./OverviewContextPanel";
import { RiskGauge } from "./RiskGauge";
import { RiskMap } from "./RiskMap";
import { TripOverview } from "./TripOverview";
import { TripPlanner } from "./TripPlanner";
import { TripDataNotice } from "./TripCoverage";
import { isAreaDashboardLocation } from "@/lib/trips/pilot";
import { NearbyUniversities } from "./NearbyUniversities";

const NAV_ITEMS: Array<{
  key: ScreenKey;
  label: string;
  icon: "overview" | "risk" | "alert" | "map" | "flood" | "reports";
}> = [
  { key: "overview", label: "Overview", icon: "overview" },
  { key: "risk", label: "Why this result", icon: "risk" },
  { key: "alerts", label: "Updates", icon: "alert" },
  { key: "map", label: "Map", icon: "map" },
  { key: "conditions", label: "Conditions", icon: "flood" },
  { key: "reports", label: "Reports", icon: "reports" },
];

interface DashboardEnvelope {
  data: DashboardSnapshot;
  meta: { backend: DataBackend; generatedAt: string };
}

function displayFactorName(name: string) {
  if (name === "School status") return "Nearby university status";
  if (name === "Official advisories") return "Official announcements";
  return name;
}

function Navigation({ activeScreen, reportsEnabled, onNavigate }: { activeScreen: ScreenKey; reportsEnabled: boolean; onNavigate: (screen: ScreenKey) => void }) {
  return (
    <ul className="nav-list">
      {NAV_ITEMS.filter((item) => item.key !== "reports" || reportsEnabled).map((item) => (
        <li key={item.key}>
          <button type="button" className={`nav-item${activeScreen === item.key ? " active" : ""}`} onClick={() => onNavigate(item.key)} aria-current={activeScreen === item.key ? "page" : undefined}>
            <Icon name={item.icon} /><span>{item.label}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function DataStatus({ backend, sources, refreshing, weatherUpdatedAt, apiUnavailable, onRefresh }: { backend: DataBackend; sources: SourceStatus[]; refreshing: boolean; weatherUpdatedAt: string | null; apiUnavailable: boolean; onRefresh: () => void }) {
  const weather = sources.find((source) => source.key === "open-meteo");
  const live = weather?.status === "active";
  const degraded = weather?.status === "degraded";
  const updated = weatherUpdatedAt
    ? new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" }).format(new Date(weatherUpdatedAt))
    : null;
  const label = apiUnavailable ? "Live updates unavailable" : live ? "Conditions updated" : degraded ? "Showing saved conditions" : backend === "mock" ? "Demo information" : "Saved conditions";
  const detail = apiUnavailable ? "You can still explore the demo, but check official sources before traveling." : updated ? `Checked at ${updated}` : live ? "Current weather included" : degraded ? "Some current updates could not be reached" : backend === "mock" ? "For exploring SafeGo only" : "Check official sources for the latest information";

  return <div className={`data-status${!apiUnavailable && live ? " live" : apiUnavailable || degraded ? " degraded" : ""}`} role="status"><span className="data-status-dot" /><span className="data-status-copy"><strong>{label}</strong><span>{detail}</span></span><button type="button" onClick={onRefresh} disabled={refreshing}>{refreshing ? "Refreshing…" : "Refresh"}</button></div>;
}

function Advisories({ items }: { items: Advisory[] }) {
  if (!items.length) return <p className="empty-note">SafeGo has no announcements to show for this area. Check official channels for the latest updates.</p>;
  return <div className="advisory-list">{items.map((item) => <article className={`adv-item${item.isMock ? " mock" : ""}`} key={`${item.source}-${item.title}`}><div className={`source-strip strip-${item.source}`} /><div className="adv-body"><div className="adv-meta-row"><div className="adv-tags"><span className={`src-tag src-${item.source}`}>{item.label}</span>{item.isMock && <span className="advisory-demo-tag">Demo</span>}</div><time className="adv-time mono">{item.date ? `${item.date} · ` : ""}{item.time}</time></div>{item.sourceUrl ? <a className="adv-title source-link" href={item.sourceUrl} target="_blank" rel="noreferrer">{item.title}</a> : <div className="adv-title">{item.title}</div>}<div className="adv-desc">{item.description}</div></div></article>)}</div>;
}

function Reports({ items }: { items: CommunityReport[] }) {
  if (!items.length) return <p className="empty-note">No community observations are available here right now.</p>;
  return <>{items.map((item, index) => <article className="report-row" key={`${item.type}-${item.title}-${item.meta}-${index}`}><div className="rtype"><Icon name={item.type === "Flooding" ? "flood" : "alert"} /></div><div className="report-main"><div className="title">{item.title}</div><div className="meta">{item.meta}</div></div><span className={`status-chip status-${item.status}`}>{item.statusLabel}</span></article>)}</>;
}

function PageHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return <div className="page-head"><div className="page-eyebrow">{eyebrow}</div><h1 className="page-title">{title}</h1><p className="page-sub">{subtitle}</p></div>;
}

function LocationPill({ location }: { location: SafeGoLocation }) {
  return <span className={`pill ${location.risk.key}`}><span className="dot" />{location.risk.name.replace(" RISK", "")}</span>;
}

function LocationOverview({ location, navigate }: { location: SafeGoLocation; navigate: (screen: ScreenKey) => void }) {
  return <section className="page"><PageHeader eyebrow="Area overview" title={location.name} subtitle={`${location.city}. Informational only.`} />
    <div className={`risk-hero risk-${location.risk.key}`}><div className="risk-hero-top"><div><div className="risk-hero-q">Current travel risk for this area</div><div className="risk-level-row"><div className="risk-level-name">{location.risk.name}</div><span className={`pill ${location.risk.key}`}><span className="dot" />{location.risk.percentage}/100</span></div><p className="risk-hero-why">{location.risk.summary}</p><div className="risk-hero-updated"><span className="mono">Last updated {location.updated}</span></div></div><div className="gauge-wrap"><RiskGauge score={location.risk.percentage} /></div></div></div>
    <OverviewContextPanel location={location} onOpenMap={() => navigate("map")} onViewConditions={() => navigate("conditions")} />
    <NearbyUniversities universities={location.universities} />
    <section className="overview-announcements" aria-labelledby="overview-announcements-title"><div className="section-title"><div className="section-title-copy"><span className="section-title-icon"><Icon name="alert" /></span><div><span>Official and local updates</span><h2 id="overview-announcements-title">Latest announcements</h2></div></div><button type="button" className="view-all" onClick={() => navigate("alerts")}>View all</button></div><Advisories items={location.advisories.slice(0, 2)} /></section>
    <p className="overview-safety-note">SafeGo does not replace government, school, or emergency announcements.</p>
  </section>;
}

function LocationRiskFactors({ location }: { location: SafeGoLocation }) {
  return <section className="page"><PageHeader eyebrow="About this result" title="Why SafeGo shows this level" subtitle={`${location.name} · ${location.risk.name.toLocaleLowerCase()}`} />
    <div className="card mb-[22px]"><div className="gauge-lg-wrap"><RiskGauge score={location.risk.percentage} size={190} /><div className="risk-level-name md">{location.risk.name}</div><p className="gauge-caption">{location.risk.summary}</p><div className="risk-hero-updated"><span className="mono">Last updated {location.updated}</span></div></div></div>
    <div className="section-title">What SafeGo considered</div>
    <div>{location.factors.map((factor) => <article className="card factor-card" key={factor.name}><div className={`factor-icon ${factor.tone}`}><Icon name={factor.icon} /></div><div className="factor-body"><div className="factor-top"><div className="factor-name">{displayFactorName(factor.name)}</div><span className={`pill ${factor.pill}`}><span className="dot" />{factor.pillText} · {factor.score}/100</span></div><p className="factor-desc">{factor.description}</p><div className="meter"><div className="meter-fill" style={{ width: `${factor.score}%`, background: riskGradient(factor.score) }} /></div></div></article>)}</div>
    <div className="card card-pad mb-[22px] result-explanation"><h2>How to use this result</h2><p>SafeGo gives more importance to flooding and road conditions, then considers weather, official updates, community observations, and nearby school information.</p>{location.risk.safetyRule && <div className="calculation-rule">{location.risk.safetyRule}</div>}<p><strong>This is not permission to travel.</strong> Conditions can change quickly, so check current government and school announcements before leaving.</p></div>
  </section>;
}

function LocationConditions({ location }: { location: SafeGoLocation }) {
  return <section className="page"><PageHeader eyebrow="Conditions" title="Flood and road conditions" subtitle={location.name} /><div className="grid grid-2"><div className="card card-pad"><div className="card-head"><h3>Watched points</h3><span className={`pill ${location.risk.key}`}><span className="dot" />{location.risk.status}</span></div><div className="route-track">{location.points.map((point) => <div className="route-node" key={`${point.label}-${point.name}`}><div className={`route-dot ${point.kind === "end" ? "end" : point.kind === "mid" ? "mid" : ""}`}><div className="inner" /></div><div className="rn-label">{point.label}</div><div className="rn-name">{point.name}</div><div className="rn-sub">{point.detail}</div></div>)}</div><div className="mock-note">These watched points come from the selected area’s available data. Use the Map view to compare locations.</div></div><div><div className="card card-pad mb-4"><div className="card-head"><h3>Flood reports</h3><span className="tag mono">Updated {location.updated}</span></div>{location.floods.map((hazard) => <div className="hazard-row" key={hazard.title}><div className={`hazard-icon ${hazard.tone ?? ""}`}><Icon name="flood" /></div><div className="hazard-body"><div className="title">{hazard.title}</div><div className="meta">{hazard.meta}</div></div></div>)}</div><div className="card card-pad"><div className="card-head"><h3>Reported hazards</h3><span className="tag mono">{location.hazards.length} listed</span></div>{location.hazards.map((hazard) => <div className="hazard-row" key={hazard.title}><div className="hazard-icon"><Icon name="alert" /></div><div className="hazard-body"><div className="title">{hazard.title}</div><div className="meta">{hazard.meta}</div></div></div>)}</div></div></div></section>;
}

function TripRiskFactors({ trip }: { trip: TripAnalysis }) {
  return <section className="page"><PageHeader eyebrow="About this result" title="Why SafeGo shows this level" subtitle={`${trip.origin.label} → ${trip.destination.label}`} />
    <TripDataNotice trip={trip} />
    {trip.overallRiskScore !== null && <div className="card card-pad mb-[22px]"><div className="gauge-lg-wrap"><RiskGauge score={trip.overallRiskScore} size={190} /><div className="risk-level-name md">{trip.riskName}</div><p className="gauge-caption">This result uses the parts of the route where SafeGo has information. Missing information is never treated as low risk.</p>{trip.safetyRule && <div className="calculation-rule route-rule">{trip.safetyRule}</div>}</div></div>}
    <div className="section-title">Places that shaped this result</div>
    <div>{trip.corridorLocations.map((location) => <article className="card factor-card route-factor-card" key={location.id}><div className="route-location-score" style={{ background: riskGradient(location.risk.percentage) }}>{location.risk.percentage}</div><div className="factor-body"><div className="factor-top"><div className="factor-name">{location.name}</div><span className={`pill ${location.risk.key}`}><span className="dot" />{location.risk.name}</span></div><p className="factor-desc">{location.risk.summary}</p><p className="route-weather-detail"><strong>Weather:</strong> {location.factors.find((factor) => factor.name === "Weather")?.description}</p><div className="route-factor-pills">{location.factors.map((factor) => <span key={factor.name}>{displayFactorName(factor.name)}: <strong>{factor.score}</strong></span>)}</div></div></article>)}</div>
  </section>;
}

function TripConditions({ trip }: { trip: TripAnalysis }) {
  return <section className="page"><PageHeader eyebrow="Route conditions" title="Hazards and reports near your trip" subtitle="Conditions reported near this route." /><div className="grid grid-2"><div className="card card-pad"><div className="card-head"><h3>Reported hazards</h3><span className="tag mono">{trip.hazards.length} listed</span></div>{trip.hazards.length ? trip.hazards.map((hazard) => <div className="hazard-row" key={`${hazard.title}-${hazard.meta}`}><div className="hazard-icon"><Icon name="alert" /></div><div className="hazard-body"><div className="title">{hazard.title}</div><div className="meta">{hazard.meta}</div></div></div>) : <p className="empty-note">No hazards are listed near the current route.</p>}</div><div><div className="card-head tight"><h3>Community observations</h3><span className="tag mono">Near route</span></div><Reports items={trip.reports} /></div></div><div className="route-coverage-note"><strong>Important:</strong> A missing report does not prove a road is safe. Check official announcements and current road conditions.</div></section>;
}

interface ReportEnvelope {
  data?: CommunityReport;
  error?: { message?: string };
}

function ReportPage({ location, items, tripMode, reportingEnabled, onSubmitted }: { location: SafeGoLocation; items: CommunityReport[]; tripMode: boolean; reportingEnabled: boolean; onSubmitted: (locationId: string, report: CommunityReport) => void }) {
  const [selectedType, setSelectedType] = useState<string>(COMMUNITY_REPORT_TYPES[0]);
  const [locationText, setLocationText] = useState(location.name);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  async function submitReport(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId: location.id,
          reportType: selectedType,
          locationText,
          description,
        }),
      });
      const envelope = (await response.json()) as ReportEnvelope;
      if (!response.ok || !envelope.data) {
        throw new Error(envelope.error?.message || "The report could not be saved.");
      }
      onSubmitted(location.id, envelope.data);
      setDescription("");
      setMessage({ tone: "success", text: "Report received as unverified. It is visible now but does not change the risk score until reviewed." });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "The report could not be saved." });
    } finally {
      setSubmitting(false);
    }
  }

  return <section className="page"><PageHeader eyebrow="Reports" title={tripMode ? "Community reports near this trip" : "Community reports in this area"} subtitle={reportingEnabled ? "Share a current observation. New reports are marked unconfirmed until reviewed." : "Public submissions will open after SafeGo can review them safely."} /><div className="grid grid-2"><div className="card card-pad">{reportingEnabled ? <form className="form-grid" onSubmit={submitReport}><fieldset className="form-field report-type-field"><legend>Report type</legend><div className="type-chip-row">{COMMUNITY_REPORT_TYPES.map((type) => <button type="button" className={`type-chip${type === selectedType ? " selected" : ""}`} aria-pressed={type === selectedType} key={type} onClick={() => setSelectedType(type)}>{type}</button>)}</div></fieldset><div className="form-field"><label htmlFor="report-location">Location or landmark</label><input id="report-location" type="text" value={locationText} onChange={(event) => setLocationText(event.target.value)} placeholder="Street or landmark" minLength={3} maxLength={160} required /></div><div className="form-field"><div className="report-label-row"><label htmlFor="report-description">What did you observe?</label><span className="mono">{description.length}/500</span></div><textarea id="report-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Water depth, road blockage, direction of travel, and what you can see" minLength={10} maxLength={500} required /></div><button className="submit-btn" type="submit" disabled={submitting}>{submitting ? "Sending report…" : "Send report for review"}</button>{message && <div className={`report-submit-message ${message.tone}`} role={message.tone === "error" ? "alert" : "status"}>{message.text}</div>}<div className="mock-note">No account is required. Do not include names, phone numbers, or other personal information.</div></form> : <div className="reporting-disabled"><Icon name="reports" /><h3>Submissions are not open yet</h3><p>SafeGo will open public reports after it can review submissions and prevent misuse. Existing observations remain visible and show whether they have been confirmed.</p></div>}</div><div><div className="card-head tight"><h3>{tripMode ? "Recent reports near the route" : "Recent reports in this area"}</h3><span className="tag mono">What SafeGo knows</span></div><Reports items={items} /></div></div></section>;
}

export function SafeGoApp({ initialLocations, initialBackend, initialSources, communityReportingEnabled }: { initialLocations: SafeGoLocation[]; initialBackend: DataBackend; initialSources: SourceStatus[]; communityReportingEnabled: boolean }) {
  const [locations, setLocations] = useState(initialLocations.filter(isAreaDashboardLocation));
  const [dataBackend, setDataBackend] = useState(initialBackend);
  const [sources, setSources] = useState(initialSources);
  const [weatherUpdatedAt, setWeatherUpdatedAt] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [apiUnavailable, setApiUnavailable] = useState(false);
  const [trip, setTrip] = useState<TripAnalysis | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<SafeGoLocation | null>(null);
  const [activeScreen, setActiveScreen] = useState<ScreenKey>("overview");

  const refreshInFlight = useRef(false);

  const refreshDashboard = useCallback(async () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    setRefreshing(true);
    try {
      const response = await fetch("/api/dashboard?refresh=true", { cache: "no-store", signal: AbortSignal.timeout(25_000) });
      if (!response.ok) throw new Error(`Dashboard returned ${response.status}`);
      const envelope = (await response.json()) as DashboardEnvelope;
      setApiUnavailable(false);
      setLocations(envelope.data.locations.filter(isAreaDashboardLocation));
      setTrip((current) => current ? assessTrip(current, envelope.data) : null);
      setDataBackend(envelope.meta.backend);
      setSources(envelope.data.sources);
      setWeatherUpdatedAt(envelope.data.weatherUpdatedAt);
      setSelectedLocation((current) => current
        ? envelope.data.locations.find((location) => location.id === current.id) ?? current
        : current);
    } catch {
      setApiUnavailable(true);
    } finally {
      refreshInFlight.current = false;
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
  const selectLocation = useCallback((location: SafeGoLocation) => {
    setTrip(null);
    setSelectedLocation(location);
    setActiveScreen("overview");
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);
  const selectMapLocation = useCallback((location: SafeGoLocation) => {
    setSelectedLocation(location);
  }, []);
  const addSubmittedReport = useCallback((locationId: string, report: CommunityReport) => {
    setLocations((current) => current.map((location) =>
      location.id === locationId
        ? { ...location, reports: [report, ...location.reports] }
        : location,
    ));
    setSelectedLocation((current) => current?.id === locationId
      ? { ...current, reports: [report, ...current.reports] }
      : current);
    setTrip((current) => current
      ? { ...current, reports: [report, ...current.reports] }
      : current);
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

  if (!selectedLocation) {
    return <main id="search-screen"><div className="search-panel trip-search-panel"><div className="brandmark search-brand"><Brand /></div><h1 className="search-title">Check a route or area</h1><p className="search-lead">See what SafeGo knows about conditions before you travel.</p><DataStatus backend={dataBackend} sources={sources} refreshing={refreshing} weatherUpdatedAt={weatherUpdatedAt} apiUnavailable={apiUnavailable} onRefresh={() => void refreshDashboard()} /><TripPlanner locations={locations} onLocation={selectLocation} onTrip={selectTrip} /><div className="suggest-label">Try a supported area</div><div className="place-chips">{locations.map((location) => <button key={location.id} type="button" className="place-chip" onClick={() => selectLocation(location)}>{location.name}</button>)}</div><p className="search-disclaimer">SafeGo is for guidance only. Always check current government, school, and emergency announcements before traveling.</p></div></main>;
  }

  return <div id="app-shell" className="active"><nav className="sidenav hidden lg:flex"><button type="button" className="brandmark brand-home" onClick={startNewTrip}><Brand compact /></button><Navigation activeScreen={activeScreen} reportsEnabled={communityReportingEnabled} onNavigate={navigate} /><button type="button" className="change-loc" onClick={startNewTrip}>{trip ? "Plan another trip" : "Check another place"}</button></nav><div className="main-col"><div className="topbar"><button type="button" className="brandmark brand-home" onClick={startNewTrip}><Brand compact /></button>{trip ? <span className={`pill ${trip.riskKey}`}><span className="dot" />{trip.riskName.replace(" RISK", "")}</span> : <LocationPill location={selectedLocation} />}</div><div className="dashboard-data-status"><DataStatus backend={dataBackend} sources={sources} refreshing={refreshing} weatherUpdatedAt={weatherUpdatedAt} apiUnavailable={apiUnavailable} onRefresh={() => void refreshDashboard()} /></div>{trip && <div className="trip-bar"><span><strong>A</strong> {trip.origin.label}</span><span className="trip-bar-arrow">→</span><span><strong>B</strong> {trip.destination.label}</span><button type="button" onClick={startNewTrip}>Change trip</button></div>}
    {activeScreen === "overview" && (trip ? <TripOverview trip={trip} navigate={navigate} /> : <LocationOverview location={selectedLocation} navigate={navigate} />)}
    {activeScreen === "risk" && (trip ? <TripRiskFactors trip={trip} /> : <LocationRiskFactors location={selectedLocation} />)}
    {activeScreen === "alerts" && <section className="page"><PageHeader eyebrow={trip ? "Route announcements" : "Area announcements"} title={trip ? "Announcements near this trip" : "Announcements for this area"} subtitle={trip ? "Official and local updates linked to locations along this route." : `${selectedLocation.name}. Newest announcements first.`} /><Advisories items={trip ? trip.advisories : selectedLocation.advisories} /></section>}
    {activeScreen === "map" && <RiskMap locations={trip ? trip.corridorLocations : locations} selectedLocation={trip ? trip.corridorLocations.find((location) => location.id === selectedLocation.id) ?? trip.corridorLocations[0] ?? selectedLocation : selectedLocation} trip={trip} onSelectLocation={selectMapLocation} onViewDashboard={() => navigate("overview")} />}
    {activeScreen === "conditions" && (trip ? <TripConditions trip={trip} /> : <LocationConditions location={selectedLocation} />)}
    {activeScreen === "reports" && <ReportPage key={`${selectedLocation.id}-${trip ? "trip" : "area"}`} location={selectedLocation} items={trip ? trip.reports : selectedLocation.reports} tripMode={Boolean(trip)} reportingEnabled={communityReportingEnabled} onSubmitted={addSubmittedReport} />}
  </div><nav className="bottom-tabs visible" aria-label="Primary navigation"><Navigation activeScreen={activeScreen} reportsEnabled={communityReportingEnabled} onNavigate={navigate} /></nav></div>;
}
