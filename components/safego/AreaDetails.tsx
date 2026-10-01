import { riskBand } from "@/lib/safego/risk-model";
import type { AreaAnalysis } from "@/lib/safego/area-analysis";
import type { AreaAdvisory } from "@/lib/safego/area-alerts";
import type { AreaProperties, AreaScore } from "@/lib/safego/area-scoring";
import { pastDayLabel, type AreaWeather, type DayWeather } from "@/lib/safego/area-weather";
import { scoreWord, type RiskMessage } from "@/lib/safego/plain-language";
import type { SafeGoLocation } from "@/lib/safego/types";
import { displayFactorName, shortPlaceName } from "./labels";
import { RiskBadge } from "./ui";

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

function Section({ title, open = false, children }: { title: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details className="group rounded-box border border-hairline" open={open}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
        {title}
        <span className="text-ink-soft transition-transform group-open:rotate-180" aria-hidden="true">▾</span>
      </summary>
      <div className="border-t border-hairline px-3 py-2.5 text-xs text-ink">{children}</div>
    </details>
  );
}

/**
 * What SafeGo knows about one map area. The summary comes first; weather is open by default and
 * everything else is tucked into sections so the panel stays short.
 */
export function AreaDetails({
  info,
  message,
  timeLabel = null,
  weatherStatus,
  coverageRadiusMeters,
  liveAlerts,
  onOpenLocation,
}: {
  info: AreaInfo;
  /** The plain-language summary for this area: why it has this rating and what to do. */
  message: RiskMessage;
  /** Set when the map is rewound: the moment being shown, e.g. "Mon, Sep 29, 3:00 PM". */
  timeLabel?: string | null;
  weatherStatus: "live" | "loading" | "unavailable" | "off";
  coverageRadiusMeters: number;
  /** PAGASA alerts are live, so official-advisory factors are real rather than sample data. */
  liveAlerts: boolean;
  onOpenLocation?: (location: SafeGoLocation) => void;
}) {
  const { properties, analysis, advisory, measuredDistanceMeters, weather, nearest } = info;
  const linkedLocation = analysis.source ?? nearest?.location ?? null;

  return (
    <>
      <p className="text-sm text-ink leading-snug">{message.why}</p>
      <p className="mt-1.5 text-sm text-ink leading-snug"><strong>What to do:</strong> {message.action}</p>
      {message.caveat && <p className="mt-1.5 text-xs text-ink-soft leading-snug">{message.caveat}</p>}

      {advisory && advisory.alerts.length > 0 && (
        <div className="mt-3 space-y-2">
          {advisory.alerts.map((alert) => (
            <div key={alert.id} className="rounded-box border border-brand/30 bg-brand-soft p-3">
              <div className="text-xs font-bold text-brand-ink">{timeLabel ? "Official alert then" : "Official alert"} · PAGASA</div>
              <a className="text-sm font-semibold text-ink underline-offset-2 hover:underline" href={alert.sourceUrl} target="_blank" rel="noreferrer">
                {alert.headline}
              </a>
              <div className="mt-0.5 text-xs text-ink-soft">{alert.severity} severity · in force until {formatTime(alert.expiresAt)}</div>
            </div>
          ))}
        </div>
      )}

      {weather && weather.pagasaLevel && (
        <div className={`mt-3 rounded-box px-3 py-2 text-xs font-semibold ${PAGASA_STYLES[weather.pagasaLevel]}`}>
          Rainfall here matches PAGASA&apos;s {weather.pagasaLevel} warning level. This is a model estimate, not an official warning.
        </div>
      )}
      {analysis.kind === "partial-estimate" && weather && weather.pastDayMm >= HEAVY_DAY_RAIN_MM && (
        <div className="mt-3 rounded-box bg-mod-soft px-3 py-2 text-xs font-semibold text-mod">
          Heavy rain fell in the last 24 hours. Streets here may still be flooded, and SafeGo has no flood data for this area.
        </div>
      )}

      <div className="mt-3 space-y-2">
        <Section title={timeLabel ? `Weather at ${timeLabel}` : "Weather now"} open>
          {weather ? (
            <>
              <strong>{weather.condition}</strong> · {Math.round(weather.temperatureCelsius)}°C · gusts {Math.round(weather.windGustKph)} km/h
              <div className="mt-2 grid grid-cols-4 gap-1 text-center">
                {[
                  ["Rain now", `${weather.currentRateMmPerHour.toFixed(1)}`, "mm/h"],
                  ["Last 3 h", `${weather.pastThreeHoursMm.toFixed(1)}`, "mm"],
                  ["Last 24 h", `${weather.pastDayMm.toFixed(1)}`, "mm"],
                  [timeLabel ? "Next 3 h" : "Next 3 h (forecast)", `${weather.nextThreeHoursMm.toFixed(1)}`, "mm"],
                ].map(([label, value, unit]) => (
                  <div key={label} className="rounded-lg bg-surface py-1.5">
                    <div className="text-[11px] leading-tight text-ink-soft">{label}</div>
                    <div className="font-bold text-ink">{value}<span className="font-normal text-ink-soft"> {unit}</span></div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-ink-soft">
                Rated {scoreWord(weather.score).toLocaleLowerCase()} ({weather.score}) because of {SCORE_DRIVERS[weather.driver]}.
                Open-Meteo weather model for {info.weatherLabel}, {formatTime(weather.observedAt)}.
              </p>
            </>
          ) : (
            <span className="text-ink-soft">
              {weatherStatus === "loading" ? "Loading live weather…"
                : weatherStatus === "off" ? "Live weather is off while SafeGo shows sample conditions."
                  : "Live weather is unavailable right now. Try again in a few minutes."}
            </span>
          )}
        </Section>

        <Section title="How this was worked out">
          <p className="mb-2">
            {analysis.kind === "rated" && analysis.source ? (
              <>A full SafeGo rating from <strong>{shortPlaceName(analysis.source.name)}</strong>
                {measuredDistanceMeters ? `, ${formatDistance(measuredDistanceMeters)} away` : ", inside this area"}.</>
            ) : analysis.kind === "partial-estimate" && analysis.source ? (
              <>A partial estimate using <strong>{shortPlaceName(analysis.source.name)}</strong>
                {measuredDistanceMeters ? ` (${formatDistance(measuredDistanceMeters)} away)` : " (inside this area)"} plus this area&apos;s own weather and official alerts.</>
            ) : analysis.kind === "partial-estimate" ? (
              <>A partial estimate from this area&apos;s weather and official alerts.
                {nearest ? ` The nearest SafeGo location, ${shortPlaceName(nearest.location.name)}, is ${formatDistance(nearest.distanceMeters)} away; SafeGo rates areas within ${formatDistance(coverageRadiusMeters)}.` : ""}</>
            ) : (
              <>Not rated: no SafeGo location is within {formatDistance(coverageRadiusMeters)} and live weather is unavailable.</>
            )}
          </p>
          {analysis.factors.map((factor) => {
            const live = factor.source === "live-weather" || factor.source === "live-alerts" || factor.source === "location";
            const tag = factor.source === "demo" ? "sample data, not counted"
              : factor.source === "live-alerts" || (factor.source === "location" && factor.name === "Official advisories" && liveAlerts) ? "PAGASA"
                : live ? (timeLabel ? "recorded" : "live") : "";
            return (
              <div key={factor.name} className="flex items-center justify-between gap-2 border-b border-hairline/60 py-1.5 last:border-b-0">
                <span>{displayFactorName(factor.name)}</span>
                <span className={`text-right ${factor.score === null || factor.source === "demo" ? "text-ink-soft" : "text-ink"}`}>
                  {factor.score === null ? "No data" : <><strong className="font-semibold">{scoreWord(factor.score)}</strong> ({factor.score})</>}
                  {tag && <span className={`ml-1.5 font-semibold ${factor.source === "demo" ? "text-mod" : "text-low"}`}>{tag}</span>}
                </span>
              </div>
            );
          })}
          <p className="mt-2 text-ink-soft">Scores run from 0 (lowest risk) to 100 (highest). “No data” means SafeGo has nothing for that factor here; it is never counted as zero.</p>
        </Section>

        <Section title="Past 4 days">
          {info.history?.length ? (
            <ul className="space-y-1.5">
              {info.history.map((day, index) => (
                <li key={day.date} className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${info.pastDay?.date === day.date ? "border-ink bg-surface" : "border-hairline"}`}>
                  <RiskBadge level={riskBand(day.score).key} label={scoreWord(day.score)} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{pastDayLabel(day.date, index + 1)} · {day.condition}</span>
                    <span className="block text-ink-soft">
                      {day.rainMm.toFixed(1)} mm rain · {Math.round(day.temperatureMinCelsius)}–{Math.round(day.temperatureMaxCelsius)}°C · gusts {Math.round(day.gustMaxKph)} km/h
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-ink-soft">
              {weatherStatus === "off" ? "Weather history is off while SafeGo shows sample conditions." : "Weather history is loading or unavailable."}
            </span>
          )}
          <p className="mt-2 text-ink-soft">Each day is rated by its worst weather, such as one thunderstorm hour.</p>
        </Section>

        <Section title="About this area">
          {properties.level === "city" ? "City / Municipality in Metro Manila" : properties.level === "district" ? "District of the City of Manila" : `Barangay in ${properties.city}`} · {properties.areaKm2.toFixed(2)} km²
          {properties.psgc && <span className="block text-ink-soft">Philippine Standard Geographic Code: {properties.psgc}</span>}
        </Section>
      </div>

      {linkedLocation && onOpenLocation && (
        <button type="button" className="mt-3 min-h-11 w-full rounded-box bg-brand text-sm font-semibold text-white hover:bg-brand-hover" onClick={() => onOpenLocation(linkedLocation)}>
          {analysis.source ? "See" : "Go to nearest:"} {shortPlaceName(linkedLocation.name)}
        </button>
      )}
    </>
  );
}
