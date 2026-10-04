"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  DashboardSnapshot,
  DataBackend,
  SourceStatus,
} from "@/lib/data/contracts";
import { riskGradient } from "@/lib/safego/risk-model";
import type {
  Advisory,
  CommunityReport,
  FactorName,
  SafeGoLocation,
  ScreenKey,
  UniversityStatus,
} from "@/lib/safego/types";
import { COMMUNITY_REPORT_TYPES } from "@/lib/reports/report-input";
import type { TripAnalysis } from "@/lib/trips/types";
import { assessTrip } from "@/lib/trips/trip-assessment";
import { UNKNOWN_ROUTE_COLOR } from "@/lib/trips/pilot";
import { buildRouteEstimate } from "@/lib/trips/route-estimate";
import type { RouteEstimate } from "@/lib/trips/route-risk";
import { honestLocation, honestSnapshot, liveFactorNames } from "@/lib/safego/honest-risk";
import { Brand } from "./Brand";
import { Icon } from "./Icon";
import { RiskGauge } from "./RiskGauge";
import { RiskMap, type PreviewTripRoute } from "./RiskMap";
import { TripPlanner } from "./TripPlanner";
import { TripDataNotice } from "./TripCoverage";
import { AccountPanel, loadAccountSession } from "./AccountPanel";
import { displayFactorName, shortPlaceName } from "./labels";
import { activeUniversityAlerts, SAMPLE_ANNOUNCEMENT_ID, sampleUniversityAlert } from "@/lib/safego/university-alerts";
import { UniversityAlertCards } from "./UniversityAlertCards";
import { UniversityScanPanel } from "./UniversityScanPanel";
import { UniversitySourceDirectory } from "./UniversitySourceDirectory";
import { RiskBadge, ThemeToggle, useIsDesktop, useSavedTheme } from "./ui";
import type { AccountProfile } from "@/lib/account/types";

const DETAIL_TABS: Array<{ key: ScreenKey; label: string }> = [
  { key: "risk", label: "Why this result" },
  { key: "conditions", label: "Conditions" },
  { key: "alerts", label: "Updates" },
  { key: "reports", label: "Reports" },
];

/** Height of the phone bottom tab bar; the map's sheet sits above it. */
const MOBILE_NAV_HEIGHT = 56;

interface DashboardEnvelope {
  data: DashboardSnapshot;
  meta: { backend: DataBackend; generatedAt: string };
}

function DataStatus({ backend, sources, refreshing, weatherUpdatedAt, apiUnavailable, onRefresh }: { backend: DataBackend; sources: SourceStatus[]; refreshing: boolean; weatherUpdatedAt: string | null; apiUnavailable: boolean; onRefresh: () => void }) {
  const weather = sources.find((source) => source.key === "open-meteo");
  const live = weather?.status === "active";
  const degraded = weather?.status === "degraded";
  const updated = weatherUpdatedAt
    ? new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" }).format(new Date(weatherUpdatedAt))
    : null;
  const label = apiUnavailable ? "Live updates unavailable" : live ? "Live weather" : degraded ? "Some live sources unavailable" : "Waiting for live information";
  const detail = apiUnavailable ? "SafeGo cannot reach its live services. Check official sources before travelling." : live && updated ? `${weather?.name ?? "Weather provider"} · checked ${updated}` : updated ? `Checked at ${updated}` : live ? "Current weather included" : degraded ? "Some current updates could not be reached" : backend === "database" ? "No current update is available" : "No saved conditions are being substituted";

  return <div className={`data-status${!apiUnavailable && live ? " live" : apiUnavailable || degraded ? " degraded" : ""}`} role="status"><span className="data-status-dot" /><span className="data-status-copy"><strong>{label}</strong><span>{detail}</span></span><button type="button" onClick={onRefresh} disabled={refreshing}>{refreshing ? "Refreshing…" : "Refresh"}</button></div>;
}

function Advisories({ items }: { items: Advisory[] }) {
  if (!items.length) return <p className="empty-note">SafeGo has no announcements to show for this area. Check official channels for the latest updates.</p>;
  return <div className="advisory-list">{items.filter((item) => !item.isMock).map((item) => <article className="adv-item" key={`${item.source}-${item.title}`}><div className={`source-strip strip-${item.source}`} /><div className="adv-body"><div className="adv-meta-row"><div className="adv-tags"><span className={`src-tag src-${item.source}`}>{item.label}</span></div><time className="adv-time mono">{item.date ? `${item.date} · ` : ""}{item.time}</time></div>{item.sourceUrl ? <a className="adv-title source-link" href={item.sourceUrl} target="_blank" rel="noreferrer">{item.title}</a> : <div className="adv-title">{item.title}</div>}<div className="adv-desc">{item.description}</div></div></article>)}</div>;
}

function Reports({ items }: { items: CommunityReport[] }) {
  if (!items.length) return <p className="empty-note">No community observations are available here right now.</p>;
  return <>{items.map((item, index) => <article className="report-row" key={`${item.type}-${item.title}-${item.meta}-${index}`}><div className="rtype"><Icon name={item.type === "Flooding" ? "flood" : "alert"} /></div><div className="report-main"><div className="title">{item.title}</div><div className="meta">{item.meta}</div></div><span className={`status-chip status-${item.status}`}>{item.statusLabel}</span></article>)}</>;
}

function PageHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return <div className="page-head"><div className="page-eyebrow">{eyebrow}</div><h1 className="page-title">{title}</h1><p className="page-sub">{subtitle}</p></div>;
}

function FactorBasisTag({ location, factor }: { location: SafeGoLocation; factor: FactorName }) {
  if (!location.risk.countedFactors) return null;
  return location.risk.countedFactors.includes(factor)
    ? <span className="text-[10px] font-bold text-low">Live</span>
    : <span className="text-[10px] font-bold text-ink-soft">Unavailable</span>;
}

function BasisNote({ location }: { location: SafeGoLocation }) {
  if (location.risk.basis === "partial") {
    return <div className="calculation-rule">Partial rating: only connected live factors are counted. Missing factors are not treated as safe.</div>;
  }
  if (location.risk.basis === "none") {
    return <div className="calculation-rule">Not rated: SafeGo has no live data for this location right now. Not rated does not mean safe.</div>;
  }
  return null;
}

function LocationRiskFactors({ location }: { location: SafeGoLocation }) {
  const rated = location.risk.basis !== "none";
  return <section className="page">
    <PageHeader eyebrow="About this result" title="Why SafeGo shows this level" subtitle={`${location.name} · ${location.risk.name.toLocaleLowerCase()}${location.risk.basis === "partial" ? " (partial)" : ""}`} />
    <div className="card mb-[22px]">
      <div className="gauge-lg-wrap">
        {rated ? <RiskGauge score={location.risk.percentage} size={190} /> : <div className="risk-level-name md">–</div>}
        <div className="risk-level-name md">{location.risk.name}{location.risk.basis === "partial" ? " (partial)" : ""}</div>
        <p className="gauge-caption">{location.risk.summary}</p>
        <BasisNote location={location} />
        <div className="risk-hero-updated"><span className="mono">Last updated {location.updated}</span></div>
      </div>
    </div>
    <div className="section-title">What SafeGo considered</div>
    <div>{location.factors.filter((factor) => !location.risk.countedFactors || location.risk.countedFactors.includes(factor.name)).map((factor) => {
      const counted = !location.risk.countedFactors || location.risk.countedFactors.includes(factor.name);
      return <article className={`card factor-card${counted ? "" : " opacity-70"}`} key={factor.name}>
        <div className={`factor-icon ${factor.tone}`}><Icon name={factor.icon} /></div>
        <div className="factor-body">
          <div className="factor-top">
            <div className="factor-name">{displayFactorName(factor.name)} <FactorBasisTag location={location} factor={factor.name} /></div>
            <span className={`pill ${factor.pill}`}><span className="dot" />{factor.pillText} · {factor.score}/100</span>
          </div>
          <p className="factor-desc">{factor.description}</p>
          <div className="meter"><div className="meter-fill" style={{ width: `${factor.score}%`, background: riskGradient(factor.score) }} /></div>
        </div>
      </article>;
    })}</div>
    <div className="card card-pad mb-[22px] result-explanation">
      <h2>How to use this result</h2>
      <p>SafeGo gives more importance to flooding and road conditions, then considers weather, official updates, community observations, and nearby school information. Only factors backed by current connected data are shown and counted.</p>
      {location.risk.safetyRule && <div className="calculation-rule">{location.risk.safetyRule}</div>}
      <p><strong>This is not permission to travel.</strong> Conditions can change quickly, so check current government and school announcements before leaving.</p>
    </div>
  </section>;
}

function LocationConditions({ location }: { location: SafeGoLocation }) {
  return <section className="page"><PageHeader eyebrow="Conditions" title="Flood and road conditions" subtitle={location.name} /><div className="grid grid-2"><div className="card card-pad"><div className="card-head"><h3>Watched points</h3><span className={`pill ${location.risk.key}`}><span className="dot" />{location.risk.status}</span></div><div className="route-track">{location.points.map((point) => <div className="route-node" key={`${point.label}-${point.name}`}><div className={`route-dot ${point.kind === "end" ? "end" : point.kind === "mid" ? "mid" : ""}`}><div className="inner" /></div><div className="rn-label">{point.label}</div><div className="rn-name">{point.name}</div><div className="rn-sub">{point.detail}</div></div>)}</div><div className="mock-note">These watched points come from the selected area’s available data. Use the Map view to compare locations.</div></div><div><div className="card card-pad mb-4"><div className="card-head"><h3>Flood reports</h3><span className="tag mono">Updated {location.updated}</span></div>{location.floods.map((hazard) => <div className="hazard-row" key={hazard.title}><div className={`hazard-icon ${hazard.tone ?? ""}`}><Icon name="flood" /></div><div className="hazard-body"><div className="title">{hazard.title}</div><div className="meta">{hazard.meta}</div></div></div>)}</div><div className="card card-pad"><div className="card-head"><h3>Reported hazards</h3><span className="tag mono">{location.hazards.length} listed</span></div>{location.hazards.map((hazard) => <div className="hazard-row" key={hazard.title}><div className="hazard-icon"><Icon name="alert" /></div><div className="hazard-body"><div className="title">{hazard.title}</div><div className="meta">{hazard.meta}</div></div></div>)}</div></div></div></section>;
}

function TripRiskFactors({ trip }: { trip: TripAnalysis }) {
  const partial = trip.corridorLocations.some((location) => location.risk.basis === "partial");
  return <section className="page">
    <PageHeader eyebrow="About this result" title="Why SafeGo shows this level" subtitle={`${trip.origin.label} → ${trip.destination.label}`} />
    <TripDataNotice trip={trip} />
    {trip.overallRiskScore !== null && <div className="card card-pad mb-[22px]">
      <div className="gauge-lg-wrap">
        <RiskGauge score={trip.overallRiskScore} size={190} />
        <div className="risk-level-name md">{trip.riskName}{partial ? " (partial)" : ""}</div>
        <p className="gauge-caption">This result uses the parts of the route where SafeGo has information. Missing information is never treated as low risk.</p>
        {partial && <div className="calculation-rule">Partial rating: places along this route count only their connected live factors. Missing information is not treated as safe.</div>}
        {trip.safetyRule && <div className="calculation-rule route-rule">{trip.safetyRule}</div>}
      </div>
    </div>}
    <div className="section-title">Places that shaped this result</div>
    <div>{trip.corridorLocations.map((location) => {
      const rated = location.risk.basis !== "none";
      return <article className="card factor-card route-factor-card" key={location.id}>
        <div className="route-location-score" style={{ background: rated ? riskGradient(location.risk.percentage) : UNKNOWN_ROUTE_COLOR }}>{rated ? location.risk.percentage : "–"}</div>
        <div className="factor-body">
          <div className="factor-top">
            <div className="factor-name">{location.name}</div>
            <span className={`pill ${rated ? location.risk.key : "unknown"}`}><span className="dot" />{location.risk.name}{location.risk.basis === "partial" ? " (partial)" : ""}</span>
          </div>
          <p className="factor-desc">{location.risk.summary}</p>
          <p className="route-weather-detail"><strong>Weather:</strong> {location.factors.find((factor) => factor.name === "Weather")?.description}</p>
          <div className="route-factor-pills">{location.factors.filter((factor) => !location.risk.countedFactors || location.risk.countedFactors.includes(factor.name)).map((factor) => {
            const counted = !location.risk.countedFactors || location.risk.countedFactors.includes(factor.name);
            return <span key={factor.name} className={counted ? "" : "opacity-60"}>
              {displayFactorName(factor.name)}: <strong>{factor.score}</strong>
            </span>;
          })}</div>
        </div>
      </article>;
    })}</div>
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
  // Every score in the app comes from live factors only; see lib/safego/honest-risk.ts.
  const [locations, setLocations] = useState(() => {
    const live = liveFactorNames(initialSources, initialBackend);
    return initialLocations.map((location) => honestLocation(location, live));
  });
  const [dataBackend, setDataBackend] = useState(initialBackend);
  const [sources, setSources] = useState(initialSources);
  const [weatherUpdatedAt, setWeatherUpdatedAt] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [apiUnavailable, setApiUnavailable] = useState(false);
  const [trip, setTrip] = useState<TripAnalysis | null>(null);
  const [previewRoute, setPreviewRoute] = useState<PreviewTripRoute | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<SafeGoLocation | null>(null);
  const [activeScreen, setActiveScreen] = useState<ScreenKey>("overview");
  const [account, setAccount] = useState<AccountProfile | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  // Phones: the planner opens from the floating search bar.
  const [plannerOpen, setPlannerOpen] = useState(false);
  // Desktop: the map draws its legend into the sidebar.
  const [legendSlot, setLegendSlot] = useState<HTMLDivElement | null>(null);
  const [dismissedUniversities, setDismissedUniversities] = useState<ReadonlySet<string>>(() => new Set());
  // A made-up announcement people can switch on to see what a real one looks like.
  const [sampleAnnouncement, setSampleAnnouncement] = useState(false);
  // Ticks every minute so expired announcements drop off without a reload.
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  useSavedTheme();

  const isDesktop = useIsDesktop();
  const refreshInFlight = useRef(false);
  const detailScrollRef = useRef<HTMLDivElement>(null);
  // Route sections away from SafeGo locations are scored from live weather and PAGASA alerts there.
  const routeEstimateRef = useRef<RouteEstimate | null>(null);
  const routeEstimateToken = useRef(0);
  const locationsRef = useRef(locations);
  useEffect(() => {
    locationsRef.current = locations;
  }, [locations]);
  const tripRef = useRef<TripAnalysis | null>(null);
  useEffect(() => {
    tripRef.current = trip;
  }, [trip]);

  /** Builds the live estimate for this route, then re-scores the trip if it is still the one shown. */
  const rescoreWithEstimate = useCallback((route: TripAnalysis, snapshot: DashboardSnapshot) => {
    const token = ++routeEstimateToken.current;
    const weatherLive = snapshot.sources.some((source) => source.key === "open-meteo" && source.status === "active");
    const alertsLive = snapshot.sources.some((source) => source.key === "pagasa-cap" && source.status === "active");
    if (!weatherLive && !alertsLive) {
      routeEstimateRef.current = null;
      return;
    }
    void buildRouteEstimate(route.routeCoordinates, alertsLive).then((estimate) => {
      if (token !== routeEstimateToken.current) return;
      routeEstimateRef.current = estimate;
      setTrip((current) => current && current.routeCoordinates === route.routeCoordinates
        ? assessTrip(current, snapshot, estimate)
        : current);
    });
  }, []);

  const refreshDashboard = useCallback(async (): Promise<boolean> => {
    if (refreshInFlight.current) return false;
    refreshInFlight.current = true;
    setRefreshing(true);
    try {
      const response = await fetch("/api/dashboard?refresh=true", { cache: "no-store", signal: AbortSignal.timeout(25_000) });
      if (!response.ok) throw new Error(`Dashboard returned ${response.status}`);
      const envelope = (await response.json()) as DashboardEnvelope;
      setApiUnavailable(false);
      const honest = honestSnapshot(envelope.data, envelope.meta.backend);
      const live = liveFactorNames(envelope.data.sources, envelope.meta.backend);
      const byId = new Map(honest.locations.map((location) => [location.id, location]));
      const merged = [
        ...locationsRef.current.map((location) => byId.get(location.id) ?? honestLocation(location, live)),
        ...honest.locations.filter((location) => !locationsRef.current.some((candidate) => candidate.id === location.id)),
      ];
      const snapshot: DashboardSnapshot = { ...honest, locations: merged };
      setLocations(merged);
      setTrip((current) => current ? assessTrip(current, snapshot, routeEstimateRef.current) : null);
      if (tripRef.current) rescoreWithEstimate(tripRef.current, snapshot);
      setDataBackend(envelope.meta.backend);
      setSources(envelope.data.sources);
      setWeatherUpdatedAt(envelope.data.weatherUpdatedAt);
      setSelectedLocation((current) => current
        ? merged.find((location) => location.id === current.id) ?? current
        : current);
      return true;
    } catch {
      setApiUnavailable(true);
      return false;
    } finally {
      refreshInFlight.current = false;
      setRefreshing(false);
    }
  }, [rescoreWithEstimate]);

  useEffect(() => {
    const accountTimer = window.setTimeout(() => void loadAccountSession().then(setAccount), 0);
    return () => window.clearTimeout(accountTimer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: number | undefined;
    const retryDelays = [1_500, 3_000, 6_000];
    const refreshWithRetry = async (attempt = 0) => {
      const succeeded = await refreshDashboard();
      if (!succeeded && !cancelled && attempt < retryDelays.length) {
        retryTimer = window.setTimeout(() => void refreshWithRetry(attempt + 1), retryDelays[attempt]);
      }
    };
    void refreshWithRetry();
    const refreshTimer = window.setInterval(() => void refreshDashboard(), 5 * 60 * 1000);
    return () => {
      cancelled = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      window.clearInterval(refreshTimer);
    };
  }, [refreshDashboard]);

  const selectTrip = useCallback((result: TripAnalysis) => {
    // The trip API scores with every factor; re-assess the same route with honest scores.
    const snapshot = { locations, sources, weatherUpdatedAt };
    const analysis = assessTrip(result, snapshot);
    const destinationRiskId =
      analysis.destination.matchedLocationId ??
      analysis.segments.at(-1)?.basisLocationId;
    const supportingLocation =
      locations.find((location) => location.id === destinationRiskId) ??
      analysis.corridorLocations[0] ??
      locations[0];
    routeEstimateRef.current = null;
    setTrip(analysis);
    setSelectedLocation(supportingLocation);
    setActiveScreen("overview");
    setPlannerOpen(false);
    rescoreWithEstimate(analysis, snapshot);
  }, [locations, rescoreWithEstimate, sources, weatherUpdatedAt]);
  const selectLocation = useCallback((location: SafeGoLocation) => {
    routeEstimateToken.current += 1;
    setTrip(null);
    setSelectedLocation(location);
    setActiveScreen("overview");
    setPlannerOpen(false);
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
    detailScrollRef.current?.scrollTo({ top: 0 });
  }, []);
  const startNewTrip = useCallback(() => {
    routeEstimateToken.current += 1;
    setTrip(null);
    setPreviewRoute(null);
    setSelectedLocation(null);
    setActiveScreen("overview");
  }, []);

  // With nothing picked, the map card describes the first location, so the detail screens do too.
  const detailLocation = selectedLocation ?? locations[0];
  const hasSelection = Boolean(trip || selectedLocation);
  const detailTabs = DETAIL_TABS.filter((tab) =>
    tab.key !== "reports" || communityReportingEnabled || (trip ? trip.reports : detailLocation?.reports ?? []).length > 0);
  const onMap = activeScreen === "overview" || activeScreen === "map";
  const selectionTitle = trip
    ? `${shortPlaceName(trip.origin.label)} → ${shortPlaceName(trip.destination.label)}`
    : selectedLocation?.name ?? null;

  // Active announcements from universities near the selected place, or along the trip.
  const universityAlerts = useMemo(() => {
    const places = trip ? trip.corridorLocations : detailLocation ? [detailLocation] : [];
    const real = activeUniversityAlerts(
      places.flatMap((place, index) => place.universities.map((university) => ({ university, area: shortPlaceName(place.name), proximity: index }))),
      clock,
      dismissedUniversities,
    );
    return sampleAnnouncement
      ? [sampleUniversityAlert(places[0] ? shortPlaceName(places[0].name) : "your area", clock), ...real]
      : real;
  }, [clock, detailLocation, dismissedUniversities, sampleAnnouncement, trip]);
  const nearbyUniversities = useMemo(() => {
    const places = trip ? trip.corridorLocations : detailLocation ? [detailLocation] : [];
    return Array.from(new Map(
      places.flatMap((place) => place.universities).map((university) => [university.id, university] as const),
    ).values()) as UniversityStatus[];
  }, [detailLocation, trip]);
  const dismissUniversity = useCallback((id: string) => {
    if (id === SAMPLE_ANNOUNCEMENT_ID) {
      setSampleAnnouncement(false);
      return;
    }
    setDismissedUniversities((current) => new Set(current).add(id));
  }, []);

  const brandButton = (
    <button type="button" className="brandmark !mb-0 border-0 bg-transparent p-0 cursor-pointer text-left" onClick={startNewTrip} aria-label="SafeGo home, start a new search">
      <Brand compact />
    </button>
  );
  const planner = (
    <TripPlanner
      key={trip ? `${trip.origin.label}-${trip.destination.label}` : selectedLocation ? selectedLocation.id : "new"}
      locations={locations}
      onLocation={selectLocation}
      onTrip={selectTrip}
      onPreviewRoute={setPreviewRoute}
      account={account}
      initialOrigin={trip ? trip.origin.label : selectedLocation ? selectedLocation.name : undefined}
      initialDestination={trip ? trip.destination.label : undefined}
    />
  );
  const dataStatus = (
    <DataStatus backend={dataBackend} sources={sources} refreshing={refreshing} weatherUpdatedAt={weatherUpdatedAt} apiUnavailable={apiUnavailable} onRefresh={() => void refreshDashboard()} />
  );

  // Phones: a floating search bar that opens the planner, like a maps app.
  const mobileSearch = isDesktop ? null : (
    <div className="pointer-events-auto rounded-2xl border border-hairline bg-panel shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-1 p-1.5">
        <button
          type="button"
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2 text-left hover:bg-surface"
          aria-expanded={plannerOpen}
          onClick={() => setPlannerOpen((open) => !open)}
        >
          <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-ink-soft" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
          <span className={`truncate text-sm ${selectionTitle ? "font-semibold text-ink" : "text-ink-soft"}`}>
            {selectionTitle ?? "Search a place or plan a trip"}
          </span>
        </button>
        <ThemeToggle />
        <button
          type="button"
          className="size-11 shrink-0 rounded-full bg-brand-soft text-sm font-bold text-brand-ink"
          onClick={() => setAccountOpen(true)}
          aria-label={account ? `Account: ${account.name}` : "Sign in"}
        >
          {account ? account.name.slice(0, 1).toLocaleUpperCase() : (
            <svg viewBox="0 0 24 24" className="mx-auto size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c.8-3.6 3.5-5.5 7-5.5s6.200 1.900 7 5.500" /></svg>
          )}
        </button>
      </div>
      {plannerOpen && (
        <div className="max-h-[62vh] overflow-y-auto border-t border-hairline p-2 [&_.trip-planner]:border-0 [&_.trip-planner]:p-1 [&_.trip-planner]:shadow-none">
          {planner}
          {hasSelection && (
            <button type="button" className="mt-2 min-h-11 w-full rounded-box border border-hairline text-sm font-semibold text-ink hover:bg-surface" onClick={startNewTrip}>
              Clear and start over
            </button>
          )}
        </div>
      )}
    </div>
  );

  const mobileTabs: Array<{ key: ScreenKey; label: string; icon: "map" | "risk" | "flood" | "alert" | "reports" }> = [
    { key: "overview", label: "Map", icon: "map" },
    { key: "risk", label: "Why", icon: "risk" },
    { key: "conditions", label: "Conditions", icon: "flood" },
    { key: "alerts", label: "Updates", icon: "alert" },
    ...(detailTabs.some((tab) => tab.key === "reports") ? [{ key: "reports" as const, label: "Reports", icon: "reports" as const }] : []),
  ];

  return (
    <>
      <div id="app-shell" className="active w-screen h-dvh overflow-hidden flex flex-row">
        <aside className="sidenav justify-between" aria-label="Trip planner">
          <div>
            <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-hairline">
              {brandButton}
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <button className="min-h-9 rounded-full border border-hairline px-3 text-xs font-semibold text-ink hover:bg-surface" type="button" onClick={() => setAccountOpen(true)}>
                  {account ? account.name : "Sign in"}
                </button>
              </div>
            </div>

            <h1 className="mb-3 text-base font-semibold text-ink">Check a place or a trip</h1>

            {isDesktop && planner}

            {hasSelection && (
              <button type="button" className="change-loc w-full" onClick={startNewTrip}>
                Clear and start over
              </button>
            )}

            <div className="mt-5 empty:hidden" ref={setLegendSlot} />
          </div>

          <div className="mb-10 mt-5 [&_.data-status]:mb-0">{dataStatus}</div>
        </aside>

        <main className="flex-1 relative h-dvh overflow-hidden">
          {onMap ? (
            <RiskMap
              locations={trip ? trip.corridorLocations : locations}
              selectedLocation={trip ? trip.corridorLocations.find((loc) => loc.id === selectedLocation?.id) ?? trip.corridorLocations[0] ?? selectedLocation : selectedLocation}
              trip={trip}
              previewRoute={previewRoute}
              leftFloatingPanel={mobileSearch}
              onSelectLocation={trip ? selectMapLocation : selectLocation}
              onViewDashboard={() => navigate("conditions")}
              onViewRiskDetails={() => navigate("risk")}
              onViewAnnouncements={() => navigate("alerts")}
              liveWeather={!apiUnavailable && sources.some((source) => source.key === "open-meteo" && source.status === "active")}
              liveAlerts={!apiUnavailable && sources.some((source) => source.key === "pagasa-cap" && source.status === "active")}
              universityAlerts={universityAlerts}
              onDismissUniversity={dismissUniversity}
              footer={<div className="[&_.data-status]:mb-0">{dataStatus}</div>}
              notice={apiUnavailable ? "Can’t reach SafeGo’s server. Retrying; ratings may be out of date." : null}
              bottomInset={isDesktop ? 0 : MOBILE_NAV_HEIGHT}
              legendSlot={isDesktop ? legendSlot : null}
            />
          ) : (
            <div className="main-col h-dvh overflow-y-auto pb-16 lg:pb-0" ref={detailScrollRef}>
              <div className="bg-panel border-b border-hairline sticky top-0 z-30">
                <div className="mx-auto max-w-[1120px] px-3.5 lg:px-7 py-2 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-brand-ink hover:underline shrink-0"
                    onClick={() => navigate("overview")}
                  >
                    ← Map
                  </button>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-semibold text-ink truncate">{selectionTitle ?? detailLocation?.name}</span>
                    {trip ? (
                      <RiskBadge size="sm" level={trip.riskKey} partial={trip.corridorLocations.some((location) => location.risk.basis === "partial")} />
                    ) : detailLocation && (
                      <RiskBadge size="sm" level={detailLocation.risk.basis === "none" ? "unknown" : detailLocation.risk.key} partial={detailLocation.risk.basis === "partial"} />
                    )}
                  </div>
                </div>
                <nav className="mx-auto hidden max-w-[1120px] gap-1 overflow-x-auto px-7 pb-2.5 lg:flex" aria-label="Result details">
                  {detailTabs.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      className={`min-h-8 rounded-full px-3 text-xs font-semibold whitespace-nowrap transition-colors ${
                        tab.key === activeScreen ? "bg-brand text-white" : "text-ink hover:bg-surface"
                      }`}
                      aria-current={tab.key === activeScreen ? "page" : undefined}
                      onClick={() => navigate(tab.key)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </nav>
              </div>
              <div className="dashboard-data-status lg:hidden">{dataStatus}</div>
              {activeScreen === "risk" && (trip ? <TripRiskFactors trip={trip} /> : detailLocation && <LocationRiskFactors location={detailLocation} />)}
              {activeScreen === "alerts" && (
                <section className="page">
                  <PageHeader
                    eyebrow={trip ? "Along this trip" : "For this area"}
                    title="Announcements and alerts"
                    subtitle={trip ? "Official updates for places along this route." : `${detailLocation?.name ?? "This area"}. Newest first.`}
                  />
                  <UniversityAlertCards alerts={universityAlerts} limit={universityAlerts.length} onDismiss={dismissUniversity} />
                  <Advisories items={trip ? trip.advisories : detailLocation?.advisories ?? []} />
                  <UniversityScanPanel
                    sampleShown={sampleAnnouncement}
                    onToggleSample={() => setSampleAnnouncement((shown) => !shown)}
                    onScanned={() => void refreshDashboard()}
                  />
                  <UniversitySourceDirectory universities={nearbyUniversities} />
                </section>
              )}
              {activeScreen === "conditions" && (trip ? <TripConditions trip={trip} /> : detailLocation && <LocationConditions location={detailLocation} />)}
              {activeScreen === "reports" && detailLocation && (
                <ReportPage
                  key={`${detailLocation.id}-${trip ? "trip" : "area"}`}
                  location={detailLocation}
                  items={trip ? trip.reports : detailLocation.reports}
                  tripMode={Boolean(trip)}
                  reportingEnabled={communityReportingEnabled}
                  onSubmitted={addSubmittedReport}
                />
              )}
            </div>
          )}
        </main>
      </div>

      {/* Phones: bottom tab bar. The map's sheet sits just above it. */}
      <nav className="fixed inset-x-0 bottom-0 z-[1200] flex border-t border-hairline bg-panel lg:hidden" style={{ height: MOBILE_NAV_HEIGHT }} aria-label="Sections">
        {mobileTabs.map((tab) => {
          const active = tab.key === "overview" ? onMap : tab.key === activeScreen;
          return (
            <button
              key={tab.key}
              type="button"
              className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold [&_svg]:size-5 ${active ? "text-brand-ink" : "text-ink-soft"}`}
              aria-current={active ? "page" : undefined}
              onClick={() => navigate(tab.key)}
            >
              <Icon name={tab.icon} />
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      <AccountPanel
        key={`${account?.email ?? "guest"}-${accountOpen}`}
        open={accountOpen}
        account={account}
        onClose={() => setAccountOpen(false)}
        onAccount={setAccount}
      />
    </>
  );
}
