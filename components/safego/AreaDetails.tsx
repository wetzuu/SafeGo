import { riskGradient } from "@/lib/safego/risk-model";
import type { AreaAnalysis } from "@/lib/safego/area-analysis";
import type { AreaAdvisory } from "@/lib/safego/area-alerts";
import type { AreaProperties, AreaScore } from "@/lib/safego/area-scoring";
import { pastDayLabel, type AreaWeather, type DayWeather } from "@/lib/safego/area-weather";
import type { SafeGoLocation } from "@/lib/safego/types";
import { UNKNOWN_ROUTE_COLOR } from "@/lib/trips/pilot";
import { displayFactorName, riskLevelLabel, shortPlaceName } from "./labels";

export interface AreaInfo {
  properties: AreaProperties;
  /** Score from SafeGo locations within the coverage radius, for the active layer. */
  measured: AreaScore | null;
  measuredSource: SafeGoLocation | null;
  /** Distance to the location behind the area's overall analysis, when it has one. */
  measuredDistanceMeters: number | null;
  weather: AreaWeather | null;
  /** The last four complete days here, newest first; null until history loads. */
  history: DayWeather[] | null;
  /** The past day shown on the map, when a past day is selected. */
  pastDay: DayWeather | null;
  weatherLabel: string;
  /** What the map paints for the active layer; null means not rated. */
  displayScore: number | null;
  /** The painted score is a partial estimate rather than a SafeGo rating. */
  estimated: boolean;
  analysis: AreaAnalysis;
  /** Active PAGASA alerts covering the area; null when alerts are unavailable. */
  advisory: AreaAdvisory | null;
  nearest: { location: SafeGoLocation; distanceMeters: number } | null;
}

function formatDistance(meters: number) {
  return meters < 1000 ? `${Math.round(meters / 10) * 10} m` : `${(meters / 1000).toFixed(1)} km`;
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" }).format(new Date(iso));
}

const SCORE_DRIVERS: Record<AreaWeather["driver"], string> = {
  sky: "current sky conditions",
  "current-rain": "rain falling now",
  wind: "wind gusts",
  "past-hour": "rain in the last hour",
  "three-hour-total": "rain over the last 3 hours",
  forecast: "rain forecast in the next 3 hours",
};

const PAGASA_STYLES: Record<NonNullable<AreaWeather["pagasaLevel"]>, string> = {
  yellow: "bg-mod-soft text-mod",
  orange: "bg-high-soft text-high",
  red: "bg-crit-soft text-crit",
};

/** A day's rain beyond this often leaves low-lying Metro Manila streets flooded after it stops. */
const HEAVY_DAY_RAIN_MM = 50;

const SECTION_LABEL ="text-[10px] font-bold uppercase tracking-wider text-ink-soft mb-0.5";

export function AreaDetails({
  info,
  layerLabel,
  timeLabel = null,
  weatherStatus,
  coverageRadiusMeters,
  liveAlerts,
  onClose,
  onOpenLocation,
}: {
  info: AreaInfo;
  layerLabel: string;
  /** Set when the map is rewound: the moment being shown, e.g. "Mon, Sep 29, 3:00 PM". */
  timeLabel?: string | null;
  weatherStatus: "live" | "loading" | "unavailable" | "off";
  coverageRadiusMeters: number;
  /** PAGASA alerts are live, so official-advisory factors are real rather than demo data. */
  liveAlerts: boolean;
  onClose: () => void;
  onOpenLocation?: (location: SafeGoLocation) => void;
}) {
  const { properties, analysis, advisory, measuredDistanceMeters, weather, nearest, displayScore, estimated } = info;
  const linkedLocation = analysis.source ?? nearest?.location ?? null;

  return (
    <>
      <div className="flex items-start justify-between gap-3 border-b border-hairline pb-3 mb-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft truncate">
            {properties.level === "district" ? "District · City of Manila" : `Barangay · ${properties.city}`}
          </div>
          <h3 className="text-base font-bold text-ink truncate mt-0.5">{properties.name}</h3>
          <div className="text-xs text-ink-soft mt-0.5">
            {layerLabel} {displayScore === null ? "not rated" : estimated ? "partial estimate" : "score"}
          </div>
        </div>
        <div className="flex items-start gap-2 shrink-0">
          <div
            className={`size-11 rounded-full flex items-center justify-center font-bold text-sm text-white shadow-sm${estimated ? " opacity-70 ring-2 ring-offset-1 ring-ink-soft/30" : ""}`}
            style={{ backgroundColor: displayScore === null ? UNKNOWN_ROUTE_COLOR : riskGradient(displayScore) }}
          >
            {displayScore ?? "–"}
          </div>
          <button type="button" className="size-7 rounded-full text-ink-soft hover:bg-neutral-100 text-lg leading-none" onClick={onClose} aria-label="Close area details">
            ×
          </button>
        </div>
      </div>

      <dl className="space-y-2.5 text-xs">
        <div>
          <dt className={SECTION_LABEL}>Analysis</dt>
          <dd className="text-ink">
            {analysis.kind === "rated" && analysis.source ? (
              <>Full SafeGo rating from <strong>{shortPlaceName(analysis.source.name)}</strong>
                {measuredDistanceMeters ? `, ${formatDistance(measuredDistanceMeters)} from this area` : ", inside this area"}.</>
            ) : analysis.kind === "partial-estimate" && analysis.source ? (
              <>Partial estimate: live factors from <strong>{shortPlaceName(analysis.source.name)}</strong>
                {measuredDistanceMeters ? ` (${formatDistance(measuredDistanceMeters)} away)` : " (inside this area)"}
                {weather || advisory ? " plus this area's live weather and PAGASA alerts" : ""}. Demo factors are shown below but not counted,
                so street flooding and road conditions are not checked.</>
            ) : analysis.kind === "partial-estimate" ? (
              <>Partial estimate from live {[weather && "weather", advisory && "PAGASA alerts"].filter(Boolean).join(" and ")}.
                No SafeGo location is within {formatDistance(coverageRadiusMeters)}
                {nearest ? ` (nearest: ${shortPlaceName(nearest.location.name)}, ${formatDistance(nearest.distanceMeters)})` : ""},
                so street flooding, road conditions and community reports are not checked here.</>
            ) : (
              <>Not rated. No SafeGo location is within {formatDistance(coverageRadiusMeters)} and live weather is not available. Not rated does not mean safe.</>
            )}
          </dd>
        </div>

        {analysis.score !== null && analysis.riskKey && analysis.riskName && (
          <div className="flex items-center justify-between gap-2 bg-surface rounded-xl p-2.5 border border-hairline">
            <span className="text-ink-soft font-semibold">{analysis.kind === "rated" ? "Overall travel risk" : "Estimated risk"}</span>
            <span className={`pill ${analysis.riskKey} text-xs font-bold${analysis.kind === "partial-estimate" ? " opacity-75" : ""}`}>
              <span className="dot" />{analysis.score}/100 · {riskLevelLabel(analysis.riskName)}{analysis.kind === "partial-estimate" ? " (partial)" : ""}
            </span>
          </div>
        )}

        <div>
          <dt className={SECTION_LABEL}>Factors</dt>
          <dd>
            {analysis.factors.map((factor) => (
              <div key={factor.name} className="flex items-center justify-between gap-2 py-1 border-b border-hairline/60 last:border-b-0">
                <span className="text-ink-soft">{displayFactorName(factor.name)}</span>
                <span className="flex items-center gap-1.5">
                  {factor.source === "demo" ? (
                    <span className="text-[9px] font-bold uppercase text-mod">Demo · not counted</span>
                  ) : (factor.source === "live-alerts" || (factor.source === "location" && factor.name === "Official advisories" && liveAlerts)) ? (
                    <span className="text-[9px] font-bold uppercase text-low">PAGASA</span>
                  ) : factor.source === "live-weather" || factor.source === "location" ? (
                    <span className="text-[9px] font-bold uppercase text-low">{timeLabel ? "Recorded" : "Live"}</span>
                  ) : null}
                  <strong className={`font-mono ${factor.score === null ? "text-ink-soft font-normal" : factor.source === "demo" ? "text-ink-soft line-through decoration-ink-soft/50" : "text-ink"}`}>
                    {factor.score ?? "No data"}
                  </strong>
                </span>
              </div>
            ))}
          </dd>
        </div>

        <div>
          <dt className={SECTION_LABEL}>{timeLabel ? `Official alerts at ${timeLabel}` : "Official alerts"}</dt>
          <dd className="text-ink">
            {advisory ? (
              advisory.alerts.length ? (
                <ul className="space-y-1.5">
                  {advisory.alerts.map((alert) => (
                    <li key={alert.id} className="rounded-lg border border-hairline bg-surface px-2 py-1.5">
                      <a className="font-semibold text-brand hover:underline" href={alert.sourceUrl} target="_blank" rel="noreferrer">
                        {alert.headline}
                      </a>
                      <span className="block text-ink-soft">
                        {alert.severity} · {alert.urgency} · until {formatTime(alert.expiresAt)} · score {alert.severityScore}/100
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-ink-soft">{timeLabel ? "No PAGASA alert covered this area then." : "No active PAGASA alert covers this area."}</span>
              )
            ) : (
              <span className="text-ink-soft">{liveAlerts ? "Loading PAGASA alerts…" : "PAGASA alerts are unavailable right now."}</span>
            )}
            <span className="block text-[10px] text-ink-soft mt-1">Source: PAGASA public alerts (CC BY 4.0).</span>
          </dd>
        </div>

        <div>
          <dt className={SECTION_LABEL}>{timeLabel ? `Weather at ${timeLabel}` : "Weather now"}</dt>
          <dd className="text-ink">
            {weather ? (
              <>
                <strong>{weather.condition}</strong> · {Math.round(weather.temperatureCelsius)}°C · gusts {Math.round(weather.windGustKph)} km/h
                <div className="grid grid-cols-4 gap-1 mt-1.5 text-center">
                  {[
                    ["Now", `${weather.currentRateMmPerHour.toFixed(1)}`, "mm/h"],
                    ["Last 3 h", `${weather.pastThreeHoursMm.toFixed(1)}`, "mm"],
                    ["Last 24 h", `${weather.pastDayMm.toFixed(1)}`, "mm"],
                    ["Next 3 h", `${weather.nextThreeHoursMm.toFixed(1)}`, "mm"],
                  ].map(([label, value, unit]) => (
                    <div key={label} className="rounded-lg bg-surface border border-hairline py-1">
                      <div className="text-[9px] uppercase tracking-wide text-ink-soft">{label}</div>
                      <div className="font-mono font-bold text-ink">{value}<span className="text-[9px] font-normal text-ink-soft"> {unit}</span></div>
                    </div>
                  ))}
                </div>
                {weather.pagasaLevel && (
                  <div className={`mt-1.5 rounded-lg px-2 py-1 font-semibold ${PAGASA_STYLES[weather.pagasaLevel]}`}>
                    Rain meets PAGASA&apos;s {weather.pagasaLevel} rainfall threshold (model estimate, not an official warning).
                  </div>
                )}
                {analysis.kind === "partial-estimate" && weather.pastDayMm >= HEAVY_DAY_RAIN_MM && (
                  <div className="mt-1.5 rounded-lg px-2 py-1 bg-mod-soft text-mod font-semibold">
                    Heavy rain in the last 24 h. Streets here may still be flooded; SafeGo has no flood data for this area.
                  </div>
                )}
                <span className="block text-ink-soft mt-1">
                  Weather score {weather.score}/100, set by {SCORE_DRIVERS[weather.driver]}. Open-Meteo model for {info.weatherLabel}, {formatTime(weather.observedAt)}, via SafeGo.
                </span>
              </>
            ) : weatherStatus === "loading" ? (
              <span className="text-ink-soft">Loading live weather…</span>
            ) : weatherStatus === "off" ? (
              <span className="text-ink-soft">Live weather is off while SafeGo shows demo conditions.</span>
            ) : (
              <span className="text-ink-soft">Live weather is unavailable right now.</span>
            )}
          </dd>
        </div>

        <div>
          <dt className={SECTION_LABEL}>Past 4 days</dt>
          <dd>
            {info.history?.length ? (
              <ul className="space-y-1">
                {info.history.map((day, index) => (
                  <li
                    key={day.date}
                    className={`flex items-center gap-2 rounded-lg border px-2 py-1 ${
                      info.pastDay?.date === day.date ? "border-ink bg-surface" : "border-hairline"
                    }`}
                  >
                    <span
                      className="size-7 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                      style={{ backgroundColor: riskGradient(day.score) }}
                    >
                      {day.score}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-ink">
                        {pastDayLabel(day.date, index + 1)} · {day.condition}
                      </span>
                      <span className="block text-[11px] text-ink-soft">
                        {day.rainMm.toFixed(1)} mm rain (peak {day.peakHourMm.toFixed(1)} mm/h) · {Math.round(day.temperatureMinCelsius)}–{Math.round(day.temperatureMaxCelsius)}°C · gusts {Math.round(day.gustMaxKph)} km/h
                      </span>
                    </span>
                    {day.pagasaLevel && (
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${PAGASA_STYLES[day.pagasaLevel]}`}>
                        {day.pagasaLevel}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-ink-soft">
                {weatherStatus === "off" ? "Weather history is off while SafeGo shows demo conditions." : "Weather history is loading or unavailable."}
              </span>
            )}
            <span className="block text-[10px] text-ink-soft mt-1">
              Open-Meteo model weather for {info.weatherLabel}. Each day is scored by its worst conditions (e.g. one thunderstorm hour), with today&apos;s rules. PAGASA levels are model estimates, not official warnings.
            </span>
          </dd>
        </div>

        <div>
          <dt className={SECTION_LABEL}>Area</dt>
          <dd className="text-ink">
            {properties.areaKm2.toFixed(2)} km²{properties.level === "barangay" ? ` · ${properties.city}` : ""}
            {properties.psgc && <span className="text-ink-soft font-mono"> · PSGC {properties.psgc}</span>}
          </dd>
        </div>
      </dl>

      {linkedLocation && onOpenLocation && (
        <button
          type="button"
          className="mt-3 w-full py-2 bg-brand text-white text-xs font-semibold rounded-xl hover:bg-brand-hover transition-colors shadow-sm"
          onClick={() => onOpenLocation(linkedLocation)}
        >
          {analysis.source ? "Open" : "Go to nearest:"} {shortPlaceName(linkedLocation.name)}
        </button>
      )}
    </>
  );
}
