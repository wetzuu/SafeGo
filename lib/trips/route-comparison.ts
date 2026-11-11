import { bandLabel, riskBand } from "../safego/risk-model.ts";
import { bandMinimum, RISK_POLICY } from "../safego/risk-policy.ts";
import type { RiskKey } from "../safego/types.ts";
import { weatherPhrase } from "../safego/plain-language.ts";
import type { TripAnalysis } from "./types.ts";

/**
 * Comparing alternative routes. Badges never call a route "safe": SafeGo rates weather and PAGASA
 * alerts, not street flooding, so the lowest-risk route is "lowest risk", not "safest". Times are
 * OSRM free-flow driving times (no traffic or flooding), used only to compare routes.
 */

export type TradeoffVariant = "optimal" | "safe" | "caution" | "danger" | "unknown";

export type TradeoffTag =
  | "BEST BALANCE"
  | "LOWEST RISK · SLOWER"
  | "LOWEST RISK"
  | "QUICKEST · HIGHER RISK"
  | "QUICKEST"
  | "BALANCED"
  | "ALTERNATIVE"
  | "ONLY ROUTE FOUND"
  | "HIGH RISK · AVOID"
  | "NOT ENOUGH DATA";

export interface TradeoffLabel {
  tag: TradeoffTag;
  /** Colour family: optimal/safe green, caution amber, danger red, unknown grey. Never shown as words. */
  variant: TradeoffVariant;
  /** One sentence on why the route got this badge. */
  explanation: string;
}

export interface ScoredRoute {
  routeId: string;
  /** "via España Blvd, Quezon Ave". */
  summary: string;
  durationSeconds: number | null;
  distanceMeters: number | null;
  /** 0–100 overall rating; null when too little of the route is near SafeGo's data to rate it. */
  riskScore: number | null;
  hazardFactors: string[];
}

export interface ClassifiedRoute extends ScoredRoute {
  tradeoffLabel: TradeoffLabel;
  /** Seconds slower than the quickest route (0 for the quickest); null when a time is unknown. */
  deltaSeconds: number | null;
}

const PRIORITY: Record<TradeoffTag, number> = {
  "BEST BALANCE": 0,
  "ONLY ROUTE FOUND": 0,
  "LOWEST RISK · SLOWER": 1,
  "LOWEST RISK": 1,
  BALANCED: 2,
  QUICKEST: 3,
  "QUICKEST · HIGHER RISK": 3,
  ALTERNATIVE: 4,
  "NOT ENOUGH DATA": 5,
  "HIGH RISK · AVOID": 6,
};

/** Colour family from the route's own risk band, so a Moderate route is never drawn green. */
function bandVariant(score: number): TradeoffVariant {
  const key: RiskKey = riskBand(score).key;
  return key === "low" ? "safe" : key === "mod" ? "caution" : "danger";
}

export function minutes(seconds: number) {
  return Math.max(1, Math.round(seconds / 60));
}

function slowerPercent(route: ScoredRoute, quickest: number | null) {
  return route.durationSeconds === null || quickest === null || quickest <= 0
    ? null
    : ((route.durationSeconds - quickest) / quickest) * 100;
}

function byRiskThenTime(first: ScoredRoute, second: ScoredRoute) {
  return (first.riskScore ?? 101) - (second.riskScore ?? 101)
    || (first.durationSeconds ?? Infinity) - (second.durationSeconds ?? Infinity);
}

/**
 * Labels each route against the others. Deterministic: ties keep the input order (OSRM's own order,
 * main route first). Returns the routes sorted by recommendation: best balance or lowest risk first,
 * then balanced, then quickest, then the rest; routes to avoid and unrated routes last.
 */
export function classifyRoutes(routes: ScoredRoute[]): ClassifiedRoute[] {
  if (!routes.length) return [];
  const rules = RISK_POLICY.routeComparison;
  const avoidFrom = bandMinimum(rules.avoidFromBand);
  const order = new Map(routes.map((route, index) => [route.routeId, index]));
  const stable = (first: ScoredRoute, second: ScoredRoute) => order.get(first.routeId)! - order.get(second.routeId)!;

  const timed = routes.filter((route) => route.durationSeconds !== null);
  const quickest = timed.length
    ? [...timed].sort((first, second) => first.durationSeconds! - second.durationSeconds! || stable(first, second))[0]
    : null;
  const quickestSeconds = quickest?.durationSeconds ?? null;
  const labels = new Map<string, TradeoffLabel>();
  const set = (route: ScoredRoute, label: TradeoffLabel) => labels.set(route.routeId, label);
  const delta = (route: ScoredRoute) => route.durationSeconds === null || quickestSeconds === null
    ? null
    : Math.max(0, route.durationSeconds - quickestSeconds);
  const slowerText = (route: ScoredRoute) => {
    const seconds = delta(route);
    return seconds === null ? "" : seconds < 60 ? "about as quick as the quickest" : `${minutes(seconds)} min slower than the quickest`;
  };

  // Routes SafeGo cannot rate, or that are too risky to recommend, are labelled first and never compete.
  for (const route of routes) {
    if (route.riskScore === null) {
      set(route, {
        tag: "NOT ENOUGH DATA",
        variant: "unknown",
        explanation: "Too little of this route is near SafeGo's live data to rate it; that does not mean it is clear.",
      });
    } else if (route.riskScore >= avoidFrom) {
      const hazard = route.hazardFactors[0];
      set(route, {
        tag: "HIGH RISK · AVOID",
        variant: "danger",
        explanation: `${bandLabel(route.riskScore)} risk (${route.riskScore}/100)${hazard ? `, with ${hazard.toLocaleLowerCase()}` : ""}; delay or choose another route if you can.`,
      });
    }
  }

  const candidates = routes.filter((route) => !labels.has(route.routeId));

  if (routes.length === 1 && candidates.length === 1) {
    const only = candidates[0];
    set(only, {
      tag: "ONLY ROUTE FOUND",
      variant: bandVariant(only.riskScore!),
      explanation: `No other road route was found, so there is nothing to compare; this route is ${bandLabel(only.riskScore!).toLocaleLowerCase()} risk.`,
    });
  } else if (candidates.length === 1) {
    const only = candidates[0];
    set(only, {
      tag: "LOWEST RISK",
      variant: bandVariant(only.riskScore!),
      explanation: `The only route here below high risk${slowerText(only) ? `, ${slowerText(only)}` : ""}.`,
    });
  } else if (candidates.length > 1) {
    const minRisk = Math.min(...candidates.map((route) => route.riskScore!));
    const lowest = [...candidates].sort((first, second) => byRiskThenTime(first, second) || stable(first, second))[0];

    if (quickestSeconds === null) {
      // No times to compare: rank by risk alone.
      for (const route of candidates) {
        const gap = route.riskScore! - minRisk;
        set(route, route === lowest
          ? { tag: "LOWEST RISK", variant: bandVariant(route.riskScore!), explanation: "Lowest risk of the routes found; no driving times were available to compare." }
          : { tag: "ALTERNATIVE", variant: bandVariant(route.riskScore!), explanation: gap === 0 ? "Same risk as the lowest-risk route." : `${gap} points riskier than the lowest-risk route.` });
      }
    } else {
      const best = candidates
        .filter((route) => route.riskScore! <= minRisk + rules.nearLowestRiskPoints)
        .filter((route) => (slowerPercent(route, quickestSeconds) ?? Infinity) <= rules.nearQuickestPercent)
        .sort((first, second) => byRiskThenTime(first, second) || stable(first, second))[0];
      if (best) {
        const isQuickest = best === quickest;
        const isLowest = best.riskScore === minRisk;
        set(best, {
          tag: "BEST BALANCE",
          variant: riskBand(best.riskScore!).key === "low" ? "optimal" : bandVariant(best.riskScore!),
          explanation: isQuickest && isLowest
            ? `Quickest route and the lowest risk of the ${routes.length} found.`
            : `${isQuickest ? "Quickest route" : `${slowerText(best)[0].toLocaleUpperCase()}${slowerText(best).slice(1)}`}, and ${isLowest ? "the lowest risk" : `within ${best.riskScore! - minRisk} points of the lowest risk`}.`,
        });
      }

      if (!labels.has(lowest.routeId)) {
        const slower = slowerPercent(lowest, quickestSeconds);
        if (slower !== null && slower > rules.slowerPercent) {
          set(lowest, {
            tag: "LOWEST RISK · SLOWER",
            variant: bandVariant(lowest.riskScore!),
            explanation: `Lowest risk of the routes found (${lowest.riskScore}/100), but ${slowerText(lowest)} without traffic.`,
          });
        }
      }

      if (quickest && !labels.has(quickest.routeId) && quickest.riskScore !== null) {
        const gap = quickest.riskScore - minRisk;
        const higherBand = riskBand(quickest.riskScore).key !== riskBand(minRisk).key;
        set(quickest, gap >= rules.higherRiskPoints || higherBand
          ? {
              tag: "QUICKEST · HIGHER RISK",
              variant: "caution",
              explanation: `Quickest route, but ${gap} points riskier than the lowest-risk route (${bandLabel(quickest.riskScore).toLocaleLowerCase()} risk).`,
            }
          : {
              tag: "QUICKEST",
              variant: bandVariant(quickest.riskScore),
              explanation: `Quickest route; its risk is ${gap} points above the lowest.`,
            });
      }

      const quickestRisk = quickest?.riskScore ?? null;
      for (const route of candidates) {
        if (labels.has(route.routeId)) continue;
        const slower = slowerPercent(route, quickestSeconds);
        const saves = quickestRisk === null ? 0 : quickestRisk - route.riskScore!;
        if (slower !== null && slower < rules.slowerPercent && saves > 0) {
          set(route, {
            tag: "BALANCED",
            variant: bandVariant(route.riskScore!),
            explanation: `${slowerText(route)[0].toLocaleUpperCase()}${slowerText(route).slice(1)}, for ${saves} points less risk than the quickest route.`,
          });
        } else {
          const gap = route.riskScore! - minRisk;
          set(route, {
            tag: "ALTERNATIVE",
            variant: bandVariant(route.riskScore!),
            explanation: `${slowerText(route) ? `${slowerText(route)[0].toLocaleUpperCase()}${slowerText(route).slice(1)}` : "Time unknown"}, and ${gap === 0 ? "no lower risk" : `${gap} points riskier than the lowest-risk route`}.`,
          });
        }
      }
    }
  }

  return routes
    .map((route) => ({ ...route, tradeoffLabel: labels.get(route.routeId)!, deltaSeconds: delta(route) }))
    .sort((first, second) =>
      PRIORITY[first.tradeoffLabel.tag] - PRIORITY[second.tradeoffLabel.tag]
      || byRiskThenTime(first, second)
      || stable(first, second));
}

/** Hazards SafeGo actually knows along a scored trip: PAGASA alerts, notable weather and data gaps. */
export function routeHazards(trip: TripAnalysis): string[] {
  const hazards: string[] = [];
  for (const advisory of trip.advisories) {
    if (hazards.length >= 2) break;
    if (!hazards.includes(advisory.title)) hazards.push(advisory.title);
  }
  const weather = trip.corridorLocations
    .filter((location) => !location.risk.countedFactors || location.risk.countedFactors.includes("Weather"))
    .flatMap((location) => location.factors.filter((factor) => factor.name === "Weather"))
    .sort((first, second) => second.score - first.score)[0];
  if (weather && weather.score >= bandMinimum("mod")) {
    const phrase = weatherPhrase(weather.score);
    hazards.push(`${phrase[0].toLocaleUpperCase()}${phrase.slice(1)}`);
  }
  const total = trip.coverage.totalMeters;
  if (total > 0 && trip.coverage.unknownMeters > 0) {
    hazards.push(`${Math.round((trip.coverage.unknownMeters / total) * 100)}% outside SafeGo's data`);
  }
  return hazards;
}

/** The comparison view of one scored trip. */
export function scoredRoute(trip: TripAnalysis): ScoredRoute {
  return {
    routeId: trip.routeId ?? "route-1",
    summary: trip.roadNames.length ? `via ${trip.roadNames.slice(0, 2).join(", ")}` : "Main route",
    durationSeconds: trip.durationSeconds ?? null,
    distanceMeters: trip.distanceMeters ?? null,
    riskScore: trip.overallRiskScore,
    hazardFactors: routeHazards(trip),
  };
}
