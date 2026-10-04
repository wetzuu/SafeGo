import type { DashboardSnapshot, DataBackend, SourceStatus } from "../data/contracts.ts";
import { riskBand } from "./risk-model.ts";
import type { FactorName, SafeGoLocation } from "./types.ts";

const active = (sources: SourceStatus[], ...keys: string[]) =>
  sources.some((source) => keys.includes(source.key) && source.status === "active");

/**
 * Factors backed by live data right now. Missing factors must never move a score: weather needs
 * an active weather provider, official advisories need PAGASA alerts or
 * an approved feed, flood/roads needs an approved feed, and community and university data need the
 * persistent database rather than the local in-memory catalog.
 */
export function liveFactorNames(sources: SourceStatus[], backend: DataBackend): Set<FactorName> {
  const live = new Set<FactorName>();
  if (active(sources, "open-meteo")) live.add("Weather");
  if (active(sources, "pagasa-cap", "official-advisories")) live.add("Official advisories");
  if (active(sources, "flood-road")) live.add("Flood / roads");
  if (backend === "database") {
    live.add("Community reports");
    live.add("School status");
  }
  return live;
}

function listNames(names: FactorName[]) {
  const labels = names.map((name) =>
    name === "Official advisories" ? "official alerts"
      : name === "School status" ? "university status"
        : name === "Flood / roads" ? "flood and road conditions"
          : name.toLocaleLowerCase());
  return labels.length <= 1 ? labels.join("") : `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`;
}

/**
 * Rescores a location from live factors only.
 * - All factors live: the model's full rating, unchanged.
 * - Some live: a partial score, the highest live factor (the same rule as map areas), so a missing
 *   flood reading can never make a place look calmer than its riskiest live signal.
 * - None live: not rated.
 * Unavailable factors stay in the internal shape but are not presented as observations.
 */
export function honestLocation(location: SafeGoLocation, live: Set<FactorName>): SafeGoLocation {
  const counted = location.factors.filter((factor) => live.has(factor.name));
  const countedFactors = counted.map((factor) => factor.name);
  const notCounted = location.factors.filter((factor) => !live.has(factor.name)).map((factor) => factor.name);

  if (counted.length === location.factors.length) {
    return { ...location, risk: { ...location.risk, basis: "full", countedFactors } };
  }

  if (counted.length === 0) {
    return {
      ...location,
      risk: {
        ...location.risk,
        basis: "none",
        countedFactors,
        name: "NOT RATED",
        rank: "Not rated",
        percentage: 0,
        rawScore: 0,
        safetyRule: "",
        contributions: [],
        summary: "Not rated: no live data is available for this location right now. Not rated does not mean safe.",
      },
    };
  }

  const score = Math.max(...counted.map((factor) => factor.score));
  const band = riskBand(score);
  return {
    ...location,
    risk: {
      ...location.risk,
      basis: "partial",
      countedFactors,
      key: band.key,
      name: band.name,
      rank: "Partial",
      percentage: score,
      rawScore: score,
      // The model's safety rules depend on flood and advisory combinations a partial score cannot see.
      safetyRule: "",
      contributions: location.risk.contributions.filter((contribution) => live.has(contribution.name)),
      summary: `Partial rating from live ${listNames(countedFactors)} only. Unavailable: `
        + `${listNames(notCounted)}. Missing information is not treated as safe.`,
    },
  };
}

export function honestSnapshot(snapshot: DashboardSnapshot, backend: DataBackend): DashboardSnapshot {
  const live = liveFactorNames(snapshot.sources, backend);
  return {
    ...snapshot,
    locations: snapshot.locations.map((location) => honestLocation({
      ...location,
      advisories: location.advisories.filter((item) => !item.isMock),
      universities: location.universities.filter((item) => !item.isMock),
      reports: backend === "local" ? [] : location.reports,
      floods: backend === "local" ? [] : location.floods,
      hazards: backend === "local" ? [] : location.hazards,
      points: backend === "local" ? [] : location.points,
    }, live)),
  };
}

/** A location's score may be shown; false for locations that are not rated. */
export function isRated(location: SafeGoLocation) {
  return location.risk.basis !== "none";
}
