"use client";

import { bandLabel, riskGradient } from "@/lib/safego/risk-model";
import { minutes, type ClassifiedRoute, type TradeoffVariant } from "@/lib/trips/route-comparison";

/** Badge colours by variant, from the app's Low / Moderate / Critical tokens (light and dark themes). */
export const VARIANT_BADGE: Record<TradeoffVariant, string> = {
  optimal: "bg-low text-white",
  safe: "bg-low-soft text-low",
  caution: "bg-mod-soft text-mod",
  danger: "bg-crit-soft text-crit",
  unknown: "bg-neutral-soft text-ink-soft",
};

/** Line colours for the map, matching the badges. */
export const VARIANT_LINE: Record<TradeoffVariant, string> = {
  optimal: "#166534",
  safe: "#166534",
  caution: "#a16207",
  danger: "#b91c1c",
  unknown: "#64748b",
};

export function travelTime(route: ClassifiedRoute) {
  return route.durationSeconds === null ? null : `~${minutes(route.durationSeconds)} min`;
}

function timeDelta(route: ClassifiedRoute, count: number) {
  if (route.deltaSeconds === null || count < 2) return null;
  return route.deltaSeconds < 60 ? "Quickest" : `+${minutes(route.deltaSeconds)} min vs quickest`;
}

function distance(route: ClassifiedRoute) {
  return route.distanceMeters === null ? null : `${(route.distanceMeters / 1000).toFixed(1)} km`;
}

/**
 * Side-by-side route choices for one trip. Times are OSRM free-flow driving times, so they compare
 * routes and are labelled "without traffic"; ratings come from live weather and PAGASA alerts.
 */
export function RouteComparison({
  routes,
  selectedId,
  onSelect,
}: {
  routes: ClassifiedRoute[];
  selectedId: string;
  onSelect?: (routeId: string) => void;
}) {
  return (
    <section className="mb-3" aria-label="Compare routes">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-bold text-ink">{routes.length > 1 ? `Compare ${routes.length} routes` : "1 route found"}</h3>
        <span className="text-[11px] text-ink-soft">Times without traffic or flooding</span>
      </div>
      <ul className="space-y-2">
        {routes.map((route) => {
          const selected = route.routeId === selectedId;
          const time = travelTime(route);
          const delta = timeDelta(route, routes.length);
          const km = distance(route);
          return (
            <li key={route.routeId}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onSelect?.(route.routeId)}
                className={`w-full rounded-box border p-3 text-left transition-colors ${
                  selected ? "border-ink bg-panel ring-1 ring-ink" : "border-hairline bg-panel hover:bg-surface"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold tracking-wide ${VARIANT_BADGE[route.tradeoffLabel.variant]}`}>
                    {route.tradeoffLabel.tag}
                  </span>
                  {selected && <span className="text-[11px] font-semibold text-ink-soft">Shown on map</span>}
                </div>

                <div className="mt-1.5 flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-semibold text-ink">{route.summary}</span>
                  {time && <span className="mono shrink-0 text-sm font-bold text-ink">{time}</span>}
                </div>
                <div className="text-xs text-ink-soft">
                  {[km, delta].filter(Boolean).join(" · ") || "Time and distance unknown"}
                </div>

                <div className="mt-2 flex items-center gap-2">
                  {route.riskScore === null ? (
                    <span className="text-[11px] font-semibold text-ink-soft">Not rated</span>
                  ) : (
                    <>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-soft" aria-hidden="true">
                        <div className="h-full rounded-full" style={{ width: `${Math.max(4, route.riskScore)}%`, background: riskGradient(route.riskScore) }} />
                      </div>
                      <span className="shrink-0 text-[11px] font-semibold text-ink">
                        {bandLabel(route.riskScore)} risk · {route.riskScore}/100
                      </span>
                    </>
                  )}
                </div>

                {route.hazardFactors.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1" aria-label="Along this route">
                    {route.hazardFactors.map((hazard) => (
                      <li key={hazard} className="rounded-full border border-hairline px-2 py-0.5 text-[11px] text-ink">{hazard}</li>
                    ))}
                  </ul>
                )}

                <p className="mt-1.5 text-xs leading-snug text-ink-soft">{route.tradeoffLabel.explanation}</p>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
