import type { ScreenKey } from "@/lib/safego/types";
import type { TripAnalysis } from "@/lib/trips/types";
import { RiskGauge } from "./RiskGauge";
import { TripDataNotice } from "./TripCoverage";
import { NearbyUniversities } from "./NearbyUniversities";
import { Icon } from "./Icon";

export function TripOverview({ trip, navigate }: { trip: TripAnalysis; navigate: (screen: ScreenKey) => void }) {
  const riskiest = trip.corridorLocations.slice().sort((a, b) => b.risk.percentage - a.risk.percentage);
  const contextLocation = riskiest[0];
  const universities = trip.corridorLocations.flatMap((location) => location.universities);
  const distanceKm = (trip.coverage.totalMeters / 1000).toFixed(1);
  const weatherStat = contextLocation?.stats.find((s) => s.label === "Weather");
  const floodStat = contextLocation?.stats.find((s) => s.label === "Road condition");

  return (
    <section className="page max-w-[960px] mx-auto">
      {/* Google Maps Style Route Header */}
      <div className="bg-panel border border-hairline rounded-2xl p-5 mb-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-hairline pb-4 mb-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-ink-soft mb-1">
              <span>Driving route</span>
              <span>•</span>
              <span>{distanceKm} km</span>
              {trip.roadNames.length > 0 && (
                <>
                  <span>•</span>
                  <span className="truncate max-w-[280px]">via {trip.roadNames.slice(0, 2).join(", ")}</span>
                </>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-ink">Trip safety check</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-4 py-2 bg-brand text-white text-sm font-semibold rounded-xl hover:bg-brand-hover flex items-center gap-1.5 shadow-sm transition-colors"
              onClick={() => navigate("map")}
            >
              <Icon name="map" />
              <span>View map</span>
            </button>
            <button
              type="button"
              className="px-4 py-2 bg-surface text-ink text-sm font-semibold rounded-xl hover:bg-surface flex items-center gap-1.5 border border-hairline transition-colors"
              onClick={() => navigate("conditions")}
            >
              <Icon name="flood" />
              <span>Conditions</span>
            </button>
          </div>
        </div>

        {/* Risk Score Highlight */}
        <div className={`risk-hero risk-${trip.riskKey} rounded-xl !p-5`}>
          <div className="risk-hero-top">
            <div>
              <div className="risk-hero-q text-xs">Overall travel risk</div>
              <div className="risk-level-row my-1">
                <div className="risk-level-name text-2xl font-bold">{trip.riskName}</div>
                {trip.overallRiskScore !== null && (
                  <span className={`pill ${trip.riskKey} text-sm font-bold`}>
                    <span className="dot" />{trip.overallRiskScore}/100
                  </span>
                )}
              </div>
              <p className="risk-hero-why text-sm text-ink-soft mt-1">
                {trip.overallRiskScore === null
                  ? "There is not enough information to rate the entire route."
                  : "Assessed from active weather feeds, road flood monitoring, and official bulletins along your path."}
              </p>
              {trip.safetyRule && <div className="calculation-rule route-rule mt-2">{trip.safetyRule}</div>}
            </div>
            {trip.overallRiskScore !== null && (
              <div className="gauge-wrap">
                <RiskGauge score={trip.overallRiskScore} size={110} />
              </div>
            )}
          </div>
        </div>
      </div>

      <TripDataNotice trip={trip} />

      {/* Google Maps Route Highlights Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="bg-panel border border-hairline rounded-xl p-3.5 shadow-sm flex items-center gap-3">
          <div className="size-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
            <Icon name="weather" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-ink-soft">Weather</div>
            <div className="text-sm font-bold text-ink truncate">{weatherStat?.value ?? "Monitored"}</div>
          </div>
        </div>

        <div className="bg-panel border border-hairline rounded-xl p-3.5 shadow-sm flex items-center gap-3">
          <div className="size-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <Icon name="flood" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-ink-soft">Roads and flooding</div>
            <div className="text-sm font-bold text-ink truncate">{floodStat?.value ?? "Clear"}</div>
          </div>
        </div>

        <div className="bg-panel border border-hairline rounded-xl p-3.5 shadow-sm flex items-center gap-3">
          <div className="size-10 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center shrink-0">
            <Icon name="alert" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-ink-soft">Advisories</div>
            <div className="text-sm font-bold text-ink truncate">{trip.advisories.length} Active</div>
          </div>
        </div>

        <div className="bg-panel border border-hairline rounded-xl p-3.5 shadow-sm flex items-center gap-3">
          <div className="size-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <Icon name="school" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-ink-soft">Schools</div>
            <div className="text-sm font-bold text-ink truncate">{universities.length ? `${universities.length} Campuses` : "Normal"}</div>
          </div>
        </div>
      </div>

      <NearbyUniversities universities={universities} routeMode />

      {trip.roadNames.length > 0 && (
        <div className="card route-roads my-4">
          <strong>Key corridor roads</strong>
          <p>{trip.roadNames.join(" • ")}</p>
        </div>
      )}

      <p className="overview-safety-note text-center text-xs text-ink-soft mt-6">
        SafeGo does not replace government, school, or emergency announcements. Always verify local conditions before departing.
      </p>
    </section>
  );
}
