import { riskGradient } from "@/lib/safego/risk-model";
import type { AreaProperties, AreaScore } from "@/lib/safego/area-scoring";
import type { AreaWeather } from "@/lib/safego/area-weather";
import type { SafeGoLocation } from "@/lib/safego/types";
import { UNKNOWN_ROUTE_COLOR } from "@/lib/trips/pilot";
import { riskLevelLabel, shortPlaceName } from "./labels";

export interface AreaInfo {
  properties: AreaProperties;
  /** Score from SafeGo locations within the coverage radius, for the active layer. */
  measured: AreaScore | null;
  measuredSource: SafeGoLocation | null;
  measuredDistanceMeters: number | null;
  weather: AreaWeather | null;
  weatherLabel: string;
  /** What the map paints for the active layer; null means not rated. */
  displayScore: number | null;
  nearest: { location: SafeGoLocation; distanceMeters: number } | null;
}

function formatDistance(meters: number) {
  return meters < 1000 ? `${Math.round(meters / 10) * 10} m` : `${(meters / 1000).toFixed(1)} km`;
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" }).format(new Date(iso));
}

export function AreaDetails({
  info,
  layerLabel,
  weatherStatus,
  coverageRadiusMeters,
  onClose,
  onOpenLocation,
}: {
  info: AreaInfo;
  layerLabel: string;
  weatherStatus: "live" | "loading" | "unavailable" | "off";
  coverageRadiusMeters: number;
  onClose: () => void;
  onOpenLocation?: (location: SafeGoLocation) => void;
}) {
  const { properties, measured, measuredSource, measuredDistanceMeters, weather, nearest, displayScore } = info;
  const linkedLocation = measuredSource ?? nearest?.location ?? null;
  const overall = measuredSource?.risk;

  return (
    <>
      <div className="flex items-start justify-between gap-3 border-b border-hairline pb-3 mb-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft truncate">
            {properties.level === "district" ? "District · City of Manila" : `Barangay · ${properties.city}`}
          </div>
          <h3 className="text-base font-bold text-ink truncate mt-0.5">{properties.name}</h3>
          <div className="text-xs text-ink-soft mt-0.5">{layerLabel} {displayScore === null ? "not rated" : "score"}</div>
        </div>
        <div className="flex items-start gap-2 shrink-0">
          <div
            className="size-11 rounded-full flex items-center justify-center font-bold text-sm text-white shadow-sm"
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
          <dt className="text-[10px] font-bold uppercase tracking-wider text-ink-soft mb-0.5">SafeGo coverage</dt>
          <dd className="text-ink">
            {measured && measuredSource ? (
              <>Rated from <strong>{shortPlaceName(measuredSource.name)}</strong>
                {measuredDistanceMeters ? `, ${formatDistance(measuredDistanceMeters)} from this area` : ", inside this area"}.</>
            ) : nearest ? (
              <>Not rated. The nearest SafeGo location is <strong>{shortPlaceName(nearest.location.name)}</strong>, {formatDistance(nearest.distanceMeters)} away; areas are rated within {formatDistance(coverageRadiusMeters)}. Not rated does not mean safe.</>
            ) : (
              <>Not rated: SafeGo has no locations to compare. Not rated does not mean safe.</>
            )}
          </dd>
        </div>

        {overall && (
          <div className="flex items-center justify-between gap-2 bg-surface rounded-xl p-2.5 border border-hairline">
            <span className="text-ink-soft font-semibold">Overall travel risk</span>
            <span className={`pill ${overall.key} text-xs font-bold`}>
              <span className="dot" />{overall.percentage}/100 · {riskLevelLabel(overall.name)}
            </span>
          </div>
        )}

        <div>
          <dt className="text-[10px] font-bold uppercase tracking-wider text-ink-soft mb-0.5">Weather now</dt>
          <dd className="text-ink">
            {weather ? (
              <>
                <strong>{weather.condition}</strong> · {Math.round(weather.temperatureCelsius)}°C · {weather.precipitationMillimeters.toFixed(1)} mm rain · gusts {Math.round(weather.windGustKph)} km/h
                <span className="block text-ink-soft mt-0.5">
                  Weather score {weather.score}/100. Open-Meteo model for {info.weatherLabel}, {formatTime(weather.observedAt)}.
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
          <dt className="text-[10px] font-bold uppercase tracking-wider text-ink-soft mb-0.5">Area</dt>
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
          {measuredSource ? "Open" : "Go to nearest:"} {shortPlaceName(linkedLocation.name)}
        </button>
      )}
    </>
  );
}
