"use client";

import { riskGradient } from "@/lib/safego/risk-model";
import { minutesText, routeBadge, routeStory, weatherLevel } from "@/lib/safego/humanize-risk";
import { minutes, type ClassifiedRoute, type TradeoffVariant } from "@/lib/trips/route-comparison";
import { FactPill, StoryBadge, TactileCard } from "./tactile";

/** Line colours for the map by variant (green, amber, coral, grey), matching the badges. */
export const VARIANT_LINE: Record<TradeoffVariant, string> = {
  optimal: "#10b981",
  safe: "#10b981",
  caution: "#f59e0b",
  danger: "#f43f5e",
  unknown: "#64748b",
};

export function travelTime(route: ClassifiedRoute) {
  return route.durationSeconds === null ? null : `~${minutes(route.durationSeconds)} min`;
}

/** The map badge text for a route: friendly label plus drive time. */
export function routePillText(route: ClassifiedRoute) {
  const badge = routeBadge(route.tradeoffLabel.tag, route.riskScore);
  const time = travelTime(route);
  return `${badge.icon} ${badge.label}${time ? ` · ${time}` : ""}`;
}

/**
 * The route choices for a trip, as chunky tappable cards. Times are OSRM driving times without
 * traffic or flooding; ratings come from live weather and PAGASA alerts, not street checks.
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
    <section className="mb-4" aria-label="Compare routes">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="font-display text-base font-semibold text-ink">
          {routes.length > 1 ? `${routes.length} ways to get there` : "1 way to get there"}
        </h3>
        <span className="text-[11px] text-ink-soft">Times without traffic or flooding</span>
      </div>
      <ul className="space-y-3">
        {routes.map((route) => {
          const selected = route.routeId === selectedId;
          const badge = routeBadge(route.tradeoffLabel.tag, route.riskScore);
          const weather = weatherLevel(route.weatherScore ?? null);
          const via = route.summary.replace(/^via\s+/, "").split(",")[0];
          const longer = routes.length > 1 && route.deltaSeconds !== null && route.deltaSeconds >= 60 ? `+${minutesText(route.deltaSeconds)}` : null;
          return (
            <li key={route.routeId}>
              <TactileCard
                as="button"
                selected={selected}
                aria-pressed={selected}
                onClick={() => onSelect?.(route.routeId)}
                className={`w-full p-3.5 ${selected ? "" : "opacity-95"}`}
              >
                <span className="flex items-start justify-between gap-2">
                  <StoryBadge tone={badge.tone} icon={badge.icon}>{badge.label}</StoryBadge>
                  <span className="text-right">
                    {travelTime(route) && <span className="block font-display text-xl font-semibold leading-none text-ink">{travelTime(route)}</span>}
                    {longer && <span className="mt-0.5 block text-[11px] font-semibold text-ink-soft">{longer} vs quickest</span>}
                  </span>
                </span>

                <span className="mt-2.5 flex flex-wrap gap-1.5">
                  {route.distanceMeters !== null && <FactPill icon="📏">{(route.distanceMeters / 1000).toFixed(1)} km</FactPill>}
                  <FactPill icon={weather.icon}>{weather.label}</FactPill>
                  {via && via !== "Main route" && <FactPill icon="🛣️">via {via}</FactPill>}
                </span>

                <span className="mt-2.5 flex items-center gap-2" aria-label={route.riskScore === null ? "Not rated" : `Risk ${route.riskScore} out of 100`}>
                  {route.riskScore === null ? (
                    <span className="text-[11px] font-semibold text-ink-soft">Not rated</span>
                  ) : (
                    <>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface" aria-hidden="true">
                        <span className="block h-full rounded-full" style={{ width: `${Math.max(4, route.riskScore)}%`, background: riskGradient(route.riskScore) }} />
                      </span>
                      <span className="shrink-0 text-[11px] font-semibold text-ink">Risk {route.riskScore}/100</span>
                    </>
                  )}
                </span>

                {route.hazardFactors.length > 0 && (
                  <span className="mt-2 flex flex-wrap gap-1" aria-label="Along this way">
                    {route.hazardFactors.map((hazard) => (
                      <span key={hazard} className="rounded-full border border-hairline px-2 py-0.5 text-[11px] text-ink">{hazard}</span>
                    ))}
                  </span>
                )}

                <span className="mt-2 block text-[13px] leading-snug text-ink-soft">
                  {routeStory({ tag: route.tradeoffLabel.tag, deltaSeconds: route.deltaSeconds, routeCount: routes.length, score: route.riskScore })}
                  {selected && routes.length > 1 && <span className="ml-1 font-semibold text-ink">Shown on the map.</span>}
                </span>
              </TactileCard>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
