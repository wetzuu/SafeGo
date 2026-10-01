import type { RiskKey, SafeGoLocation } from "./types.ts";

export type RiskLevel = RiskKey | "unknown";

export interface RiskMessage {
  level: RiskLevel;
  /** "Low risk", "High risk", "Not rated". */
  headline: string;
  /** What is happening, in plain words. */
  why: string;
  /** What the traveller can do about it. */
  action: string;
  /** A short caveat when the rating is partial; empty otherwise. */
  caveat: string;
}

const LEVEL_NAMES: Record<RiskLevel, string> = {
  low: "Low risk",
  mod: "Moderate risk",
  high: "High risk",
  crit: "Critical risk",
  unknown: "Not rated",
};

const ACTIONS: Record<RiskLevel, string> = {
  low: "Travel as usual, and check again just before you leave.",
  mod: "Allow extra time and avoid low-lying or flood-prone roads.",
  high: "Delay non-essential trips, or take another route if you must go.",
  crit: "Avoid travel unless it is essential, and follow official instructions.",
  unknown: "SafeGo cannot advise here. Check official government and school channels.",
};

export function levelName(level: RiskLevel) {
  return LEVEL_NAMES[level];
}

export function levelAction(level: RiskLevel) {
  return ACTIONS[level];
}

/** The word for a 0–100 score, so a bare number never stands alone. */
export function scoreWord(score: number) {
  return score <= 29 ? "Low" : score <= 59 ? "Moderate" : score <= 79 ? "High" : "Critical";
}

/** "calm weather", "light rain", "heavy rain or strong wind"… from a weather score and condition. */
export function weatherPhrase(score: number, condition?: string | null) {
  const sky = condition?.trim().toLocaleLowerCase();
  if (score >= 80) return sky ? `severe weather (${sky})` : "severe weather";
  if (score >= 60) return sky ? `heavy rain or strong wind (${sky})` : "heavy rain or strong wind";
  if (score >= 30) return sky ? `unsettled weather (${sky})` : "rain or gusty wind";
  return sky ? `calm weather (${sky})` : "calm weather";
}

export function advisoryPhrase(score: number, count = 0) {
  if (score <= 0) return "no official alerts";
  const amount = count > 1 ? `${count} official alerts` : "an official alert";
  return score >= 60 ? `${amount} of serious concern` : `${amount} in effect`;
}

function sentence(parts: string[]) {
  const text = parts.filter(Boolean).join(", and ");
  return text ? `${text[0].toLocaleUpperCase()}${text.slice(1)}.` : "";
}

/** What is known, why it matters and what to do, for anything rated from weather and official alerts. */
export function describeRisk(input: {
  level: RiskLevel;
  /** How complete the rating is. */
  basis?: "full" | "partial" | "none";
  weather?: { score: number; condition?: string | null } | null;
  advisory?: { score: number; count?: number } | null;
}): RiskMessage {
  const level = input.basis === "none" ? "unknown" : input.level;
  if (level === "unknown") {
    return {
      level,
      headline: LEVEL_NAMES.unknown,
      why: "SafeGo has no live data here right now. Not rated does not mean safe.",
      action: ACTIONS.unknown,
      caveat: "",
    };
  }
  const why = sentence([
    input.weather ? weatherPhrase(input.weather.score, input.weather.condition) : "",
    input.advisory ? advisoryPhrase(input.advisory.score, input.advisory.count) : "",
  ]) || "Based on the latest information SafeGo has.";
  return {
    level,
    headline: LEVEL_NAMES[level],
    why,
    action: ACTIONS[level],
    caveat: input.basis === "partial"
      ? "Based on live weather and official alerts only. Street flooding and road conditions are not checked yet."
      : "",
  };
}

/** The same message for a SafeGo location, read from the factors that count toward its score. */
export function describeLocation(location: SafeGoLocation): RiskMessage {
  const counted = location.risk.countedFactors;
  const factor = (name: string) => {
    const found = location.factors.find((candidate) => candidate.name === name);
    return found && (!counted || counted.some((item) => item === name)) ? found : null;
  };
  const weather = factor("Weather");
  const advisory = factor("Official advisories");
  return describeRisk({
    level: location.risk.key,
    basis: location.risk.basis,
    // Weather descriptions start with the sky condition, e.g. "Partly cloudy. Rain now…".
    weather: weather ? { score: weather.score, condition: weather.description.split(/[.,]/)[0] } : null,
    advisory: advisory ? { score: advisory.score, count: location.advisories.length } : null,
  });
}
