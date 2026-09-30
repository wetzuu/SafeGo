import type { ActiveAlert, AreaAdvisory } from "./area-alerts.ts";
import type { AreaWeather, WeatherSamplePoint } from "./area-weather.ts";
import { honestLocation } from "./honest-risk.ts";
import { riskBand } from "./risk-model.ts";
import type { FactorName, RiskFactor, SafeGoLocation } from "./types.ts";

/** How far back the map can be rewound. */
export const TIMELINE_HOURS = 4 * 24;
export const HOUR_MS = 60 * 60 * 1000;

/** One past hour at a sample point, scored by the backend with today's rules. */
export interface HourWeather {
  /** Manila local time, "yyyy-MM-ddTHH:mm"; the values cover the hour ending then. */
  time: string;
  score: number;
  driver: "sky" | "wind" | "past-hour" | "three-hour-total";
  condition: string;
  rainMm: number;
  threeHourMm: number;
  temperatureCelsius: number;
  gustKph: number;
  pagasaLevel: "yellow" | "orange" | "red" | null;
}

export interface AlertsTimeline {
  alerts: ActiveAlert[];
  /** Hour starts (ISO, UTC) with the alerts in force then. */
  hours: Array<{ time: string; alertIds: string[] }>;
}

/** Milliseconds for a Manila local "yyyy-MM-ddTHH:mm" time. */
export function manilaTime(local: string) {
  return Date.parse(`${local}:00+08:00`);
}

/** Latest item at or before `at`, from a list sorted oldest first. */
function latestAtOrBefore<T>(items: T[], at: number, time: (item: T) => number) {
  let found: T | null = null;
  for (const item of items) {
    if (time(item) > at) break;
    found = item;
  }
  return found;
}

/**
 * The weather reading at `at`, shaped like a live reading so every view can show it. Rain "next 3 h"
 * is what actually fell afterwards, since the past is known.
 */
export function weatherAt(hours: HourWeather[] | undefined, at: number): AreaWeather | null {
  if (!hours?.length) return null;
  const index = hours.findLastIndex((hour) => manilaTime(hour.time) <= at);
  if (index < 0) return null;
  const hour = hours[index];
  const sum = (from: number, to: number) =>
    hours.slice(Math.max(0, from), Math.max(0, to)).reduce((total, item) => total + item.rainMm, 0);
  return {
    score: hour.score,
    driver: hour.driver,
    condition: hour.condition,
    temperatureCelsius: hour.temperatureCelsius,
    windGustKph: hour.gustKph,
    currentRateMmPerHour: hour.rainMm,
    lastHourMm: hour.rainMm,
    pastThreeHoursMm: hour.threeHourMm,
    pastDayMm: Math.round(sum(index - 23, index + 1) * 10) / 10,
    nextThreeHoursMm: Math.round(sum(index + 1, index + 4) * 10) / 10,
    pagasaLevel: hour.pagasaLevel,
    observedAt: `${hour.time}:00+08:00`,
  };
}

/** PAGASA alerts that were in force at `at`. */
export function alertsAt(timeline: AlertsTimeline | null, at: number): ActiveAlert[] | null {
  if (!timeline) return null;
  const hour = latestAtOrBefore(timeline.hours, at, (item) => Date.parse(item.time));
  if (!hour) return [];
  const byId = new Map(timeline.alerts.map((alert) => [alert.id, alert]));
  return hour.alertIds.flatMap((id) => byId.get(id) ?? []);
}

function factorAt(name: FactorName, score: number, description: string, previous?: RiskFactor): RiskFactor {
  const band = riskBand(score);
  const label = { low: "Low", mod: "Moderate", high: "High", crit: "Critical" }[band.key];
  return {
    name,
    score,
    pill: band.key,
    pillText: label,
    description,
    icon: previous?.icon ?? (name === "Weather" ? "weather" : "alert"),
    tone: score >= 60 ? "icon-alert" : score >= 30 ? "icon-mod" : previous?.tone ?? "icon-ok",
  };
}

/**
 * A location as it was at a past moment: weather and PAGASA alerts from that time, every other
 * factor left as a demo placeholder, then rescored with the same honest rule as now (only the
 * factors known for that time count).
 */
export function locationAt(
  location: SafeGoLocation,
  weather: AreaWeather | null,
  advisory: AreaAdvisory | null,
  timeLabel: string,
): SafeGoLocation {
  const factors = location.factors.map((factor) => {
    if (factor.name === "Weather" && weather) {
      return factorAt("Weather", weather.score,
        `${timeLabel}: ${weather.condition}, ${weather.lastHourMm.toFixed(1)} mm rain in the hour, ${weather.pastThreeHoursMm.toFixed(1)} mm over 3 h, gusts ${Math.round(weather.windGustKph)} km/h. Open-Meteo model.`,
        factor);
    }
    if (factor.name === "Official advisories" && advisory) {
      return factorAt("Official advisories", advisory.score, advisory.alerts.length
        ? `${timeLabel}: ${advisory.alerts.map((alert) => alert.headline).join("; ")} (PAGASA).`
        : `${timeLabel}: no PAGASA alert covered this location.`, factor);
    }
    return factor;
  });
  const known = new Set<FactorName>();
  if (weather) known.add("Weather");
  if (advisory) known.add("Official advisories");
  const past = honestLocation({ ...location, factors, updated: timeLabel }, known);
  return {
    ...past,
    advisories: advisory
      ? advisory.alerts.map((alert) => ({
        source: "weather" as const,
        label: "PAGASA",
        title: alert.headline,
        description: alert.description,
        time: "",
        date: timeLabel,
        sourceUrl: alert.sourceUrl,
      }))
      : [],
  };
}

/** "Mon, Sep 29, 3:00 PM" in Manila time. */
export function timelineLabel(at: number) {
  return new Intl.DateTimeFormat("en-PH", {
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila",
  }).format(new Date(at));
}

/** The latest whole hour, which is where the slider ends ("now"). */
export function currentHour(now = Date.now()) {
  return Math.floor(now / HOUR_MS) * HOUR_MS;
}

interface Envelope<T> {
  data?: T & { source: { status: string; errorMessage: string | null } };
  error?: { message?: string };
}

async function readEnvelope<T>(response: Response, what: string) {
  const envelope = (await response.json().catch(() => null)) as Envelope<T> | null;
  if (!response.ok || !envelope?.data) throw new Error(envelope?.error?.message ?? `${what} returned HTTP ${response.status}.`);
  if (envelope.data.source.status !== "active") {
    throw new Error(envelope.data.source.errorMessage ?? `${what} source is ${envelope.data.source.status}.`);
  }
  return envelope.data;
}

let weatherCache: { key: string; expiresAt: number; value: Map<string, HourWeather[]> } | null = null;

/** Hour-by-hour weather for the last four days per sample point, from SafeGo's API. Cached for 15 minutes. */
export async function fetchWeatherTimeline(points: WeatherSamplePoint[]) {
  const key = points.map((point) => point.key).join("|");
  if (weatherCache && weatherCache.key === key && weatherCache.expiresAt > Date.now()) return weatherCache.value;
  const response = await fetch("/api/areas/weather/timeline", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      points: points.map((point) => ({ key: point.key, latitude: point.coordinates[0], longitude: point.coordinates[1] })),
    }),
    signal: AbortSignal.timeout(25_000),
  });
  const data = await readEnvelope<{ timelines: Array<{ key: string; hours: HourWeather[] }> }>(response, "Weather timeline");
  const value = new Map(data.timelines.map(({ key: pointKey, hours }) => [pointKey, hours]));
  weatherCache = { key, expiresAt: Date.now() + 15 * 60 * 1000, value };
  return value;
}

/** Which PAGASA alerts were in force over Metro Manila, hour by hour, for the last four days. */
export async function fetchAlertsTimeline(): Promise<AlertsTimeline> {
  const response = await fetch("/api/alerts/timeline", {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  });
  const data = await readEnvelope<AlertsTimeline>(response, "Alerts timeline");
  return { alerts: data.alerts, hours: data.hours };
}
