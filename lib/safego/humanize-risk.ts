/**
 * Plain-language copy for the interface: turns scores, route trade-offs and school scans into short
 * headlines, icons and tones. Honest by construction: SafeGo rates weather and PAGASA alerts, not
 * street flooding, so nothing here claims a flood depth, a dry street or a safe route.
 */
import { riskBand } from "./risk-model.ts";
import { bandMinimum } from "./risk-policy.ts";
import type { TradeoffTag } from "../trips/route-comparison.ts";

export type Tone = "calm" | "best" | "rain" | "wet" | "danger" | "school" | "unknown";

/** The tone for a 0–100 rating: calm (Low), rain (Moderate), danger (High and Critical). */
export function toneForScore(score: number | null): Tone {
  if (score === null) return "unknown";
  const key = riskBand(score).key;
  return key === "low" ? "calm" : key === "mod" ? "rain" : "danger";
}

export interface WeatherLevel {
  /** 0 calm, 1 light, 2 heavy, 3 severe; null when there is no live weather. */
  step: 0 | 1 | 2 | 3 | null;
  icon: string;
  label: string;
  advice: string;
  tone: Tone;
}

/** Weather intensity from SafeGo's 0–100 weather score (rain, gusts and sky together). */
export function weatherLevel(score: number | null | undefined): WeatherLevel {
  if (score === null || score === undefined) {
    return { step: null, icon: "❔", label: "No live weather", advice: "SafeGo can't see the weather here right now.", tone: "unknown" };
  }
  if (score < bandMinimum("mod") - 5) {
    return { step: 0, icon: "☀️", label: "Calm", advice: "No rain worth worrying about right now.", tone: "calm" };
  }
  if (score < bandMinimum("mod") + 15) {
    return { step: 1, icon: "🌦️", label: "Light rain or gusts", advice: "Bring an umbrella.", tone: "wet" };
  }
  if (score < bandMinimum("high") + 10) {
    return { step: 2, icon: "🌧️", label: "Heavy rain or strong wind", advice: "Low streets and underpasses may flood. Leave extra time.", tone: "rain" };
  }
  return { step: 3, icon: "⛈️", label: "Severe weather", advice: "Stay put if you can, and follow official advice.", tone: "danger" };
}

export interface RouteBadge {
  label: string;
  icon: string;
  tone: Tone;
}

/** Friendly badge for a route trade-off. Never says safe or dry. */
export function routeBadge(tag: TradeoffTag, score: number | null): RouteBadge {
  switch (tag) {
    case "BEST BALANCE": return { label: "Best of both", icon: "✨", tone: "best" };
    case "LOWEST RISK · SLOWER": return { label: "Calmest, takes longer", icon: "🐢", tone: toneForScore(score) };
    case "LOWEST RISK": return { label: "Calmest way", icon: "🌤️", tone: toneForScore(score) };
    case "QUICKEST · HIGHER RISK": return { label: "Quickest, rougher", icon: "⚡", tone: "rain" };
    case "QUICKEST": return { label: "Quickest", icon: "⚡", tone: toneForScore(score) };
    case "BALANCED": return { label: "In between", icon: "⚖️", tone: toneForScore(score) };
    case "ALTERNATIVE": return { label: "Another way", icon: "↪️", tone: toneForScore(score) };
    case "ONLY ROUTE FOUND": return { label: "Only way found", icon: "🛣️", tone: toneForScore(score) };
    case "HIGH RISK · AVOID": return { label: "Skip if you can", icon: "🚫", tone: "danger" };
    case "NOT ENOUGH DATA": return { label: "Not enough data", icon: "❔", tone: "unknown" };
  }
}

export function minutesText(seconds: number) {
  return `${Math.max(1, Math.round(seconds / 60))} min`;
}

/** One plain sentence on why a route got its badge. */
export function routeStory(input: { tag: TradeoffTag; deltaSeconds: number | null; routeCount: number; score: number | null }) {
  const extra = input.deltaSeconds !== null && input.deltaSeconds >= 60 ? `${minutesText(input.deltaSeconds)} longer` : null;
  switch (input.tag) {
    case "BEST BALANCE":
      return extra ? `Only ${extra} than the quickest, and about the calmest of the ${input.routeCount} ways.` : `The quickest and calmest of the ${input.routeCount} ways.`;
    case "LOWEST RISK · SLOWER":
      return `The calmest of the ${input.routeCount} ways${extra ? `, but ${extra}` : ""}.`;
    case "LOWEST RISK":
      return "The calmest way SafeGo found.";
    case "QUICKEST · HIGHER RISK":
      return "Gets you there first, but rain or alerts are rougher along it.";
    case "QUICKEST":
      return "Gets you there first, and conditions are close to the calmest way.";
    case "BALANCED":
      return `${extra ? `${extra[0].toUpperCase()}${extra.slice(1)}` : "About as quick"}, a bit calmer than the quickest.`;
    case "ALTERNATIVE":
      return `${extra ? `${extra[0].toUpperCase()}${extra.slice(1)}` : "About as quick"}, and no calmer.`;
    case "ONLY ROUTE FOUND":
      return "No other road was found, so there's nothing to compare.";
    case "HIGH RISK · AVOID":
      return "Rough weather or alerts along this way. Wait it out or pick another if you can.";
    case "NOT ENOUGH DATA":
      return "Too little of this way is near SafeGo's data to rate it. That doesn't mean it's clear.";
  }
}

export interface SkySuspension {
  name: string;
  status: "suspended" | "online";
  verified: boolean;
}

export interface SkyReportInput {
  /** Highest live weather score across Metro Manila; null when weather is unavailable. */
  weatherScore: number | null;
  /** Where that weather is, e.g. "España Blvd., Sampaloc". */
  worstPlace: string | null;
  pagasaAlert: boolean;
  /** The school scan: scanned (with time), scanning, standby or off. */
  scan: { state: "scanned" | "scanning" | "standby" | "off"; at: string | null };
  suspensions: SkySuspension[];
  /** Recorded replay: say "recorded", never "now". */
  replay: boolean;
}

export const SKY_STEPS = [
  { icon: "☀️", label: "Clear" },
  { icon: "🌧️", label: "Rain" },
  { icon: "🏫", label: "Checking schools" },
  { icon: "🎒", label: "No classes" },
] as const;

export interface SkyReport {
  /** Index into SKY_STEPS; null when weather is unavailable. */
  step: 0 | 1 | 2 | 3 | null;
  headline: string;
  line: string;
  tone: Tone;
  /** Animate the current step (schools are being checked right now). */
  busy: boolean;
}

function shortPlace(place: string | null) {
  return place ? place.split(",")[0].replace(/\s*\(.*\)$/, "") : "Metro Manila";
}

/** The plain-language status for the top of the app. */
export function skyReport(input: SkyReportInput, now = Date.now()): SkyReport {
  const level = weatherLevel(input.weatherScore);
  const wet = (level.step !== null && level.step >= 1) || input.pagasaAlert;
  const when = input.scan.at ? relativeTime(input.scan.at, now) : null;

  if (input.suspensions.length) {
    const first = input.suspensions[0];
    const more = input.suspensions.length - 1;
    const what = first.status === "suspended" ? "no in-person classes" : "classes are online";
    return {
      step: 3,
      headline: more ? `${first.name} and ${more} more: ${what}` : `${first.name}: ${what}`,
      line: first.verified
        ? "From the school's or government's own post. Check your school's page for details."
        : "Reported by the news, not yet on the school's own page. Check before you skip the trip.",
      tone: "school",
      busy: false,
    };
  }
  if (input.weatherScore === null && !input.pagasaAlert) {
    return { step: null, headline: "Live weather isn't available", line: "SafeGo can't rate the weather right now. Check PAGASA and your school's page.", tone: "unknown", busy: false };
  }
  if (!wet) {
    return {
      step: 0,
      headline: input.replay ? "Skies were clear" : "Clear skies over Metro Manila",
      line: "No rain worth worrying about. SafeGo checks schools for suspensions when rain arrives.",
      tone: "calm",
      busy: false,
    };
  }
  const rainLine = input.pagasaAlert && (level.step === null || level.step < 1)
    ? "PAGASA has an alert in effect"
    : `${level.label} near ${shortPlace(input.worstPlace)}`;
  if (input.scan.state === "scanning") {
    return { step: 2, headline: `${rainLine}. Checking schools now`, line: "Looking for class suspension notices from schools, the government and the news.", tone: "school", busy: true };
  }
  if (input.scan.state === "scanned") {
    return { step: 2, headline: rainLine, line: `Schools checked ${when ?? "recently"}. No suspension found yet. ${level.step !== null && level.step >= 2 ? level.advice : "Bring an umbrella."}`, tone: level.tone, busy: false };
  }
  return { step: 1, headline: rainLine, line: input.scan.state === "off" ? level.advice : `${level.advice} SafeGo will check schools for suspensions.`, tone: level.tone, busy: false };
}

export interface SchoolTicket {
  title: string;
  meaning: string;
  source: string;
  trust: "official" | "reported";
}

/** The "no classes" ticket for one school notice. */
export function schoolTicket(input: { name: string; status: "suspended" | "online"; verified: boolean; sourceName: string | null }): SchoolTicket {
  const name = input.name.split("(")[0].trim();
  return input.status === "suspended"
    ? {
        title: `No classes on campus at ${name}`,
        meaning: "In-person classes are suspended. Stay home unless the school says otherwise.",
        source: input.sourceName ?? "the school",
        trust: input.verified ? "official" : "reported",
      }
    : {
        title: `${name} classes are online`,
        meaning: "No need to go to campus. Classes continue online.",
        source: input.sourceName ?? "the school",
        trust: input.verified ? "official" : "reported",
      };
}

/** "just now", "5 min ago", "2 h ago", or the time when older than a day. */
export function relativeTime(iso: string | number, now = Date.now()) {
  const then = typeof iso === "number" ? iso : Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const minutes = Math.round((now - then) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(then).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" });
}
