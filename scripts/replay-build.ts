// Saves a replay pack: Open-Meteo's archived forecasts around one past moment, for every point the app
// asks about (the SafeGo places and the map's area sample points). `npm run presentation -- --replay`
// serves it instead of live weather, so the demo works without internet.
//
//   npm run replay:build -- --at 2026-08-17T14:00 --label "Habagat flash floods" --source https://...
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LOCATION_ANCHORS } from "../lib/safego/locations.ts";
import { weatherSamplePoints } from "../lib/safego/area-weather.ts";
import type { AreaCollection } from "../lib/safego/area-scoring.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const option = (name: string) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};

const at = option("at");
const label = option("label");
const source = option("source");
if (!at || !/^\d{4}-\d{2}-\d{2}T\d{2}:00$/.test(at) || !label || !source?.startsWith("https://")) {
  console.error('Usage: npm run replay:build -- --at YYYY-MM-DDTHH:00 --label "What happened" --source https://dated-report');
  process.exit(1);
}

// The four days before for the rewind slider and daily summaries, and the next day for the forecast hours.
const day = (offset: number) => {
  const date = new Date(`${at.slice(0, 10)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
};

const areas = JSON.parse(readFileSync(join(root, "lib/data/ncr-cities.json"), "utf8")) as AreaCollection;
const points = [
  ...LOCATION_ANCHORS.map((anchor) => ({ key: anchor.id, coordinates: anchor.coordinates })),
  ...weatherSamplePoints(areas).map((point) => ({ key: point.key, coordinates: point.coordinates })),
];

const url = new URL("https://historical-forecast-api.open-meteo.com/v1/forecast");
url.searchParams.set("latitude", points.map((point) => point.coordinates[0].toFixed(4)).join(","));
url.searchParams.set("longitude", points.map((point) => point.coordinates[1].toFixed(4)).join(","));
url.searchParams.set("hourly", "weather_code,precipitation,wind_gusts_10m,wind_speed_10m,temperature_2m");
url.searchParams.set("daily", "weather_code,precipitation_sum,temperature_2m_max,temperature_2m_min,wind_gusts_10m_max");
url.searchParams.set("start_date", day(-5));
url.searchParams.set("end_date", day(1));
url.searchParams.set("timezone", "Asia/Manila");

const response = await fetch(url, { headers: { "User-Agent": "SafeGo/0.1 (replay pack)" }, signal: AbortSignal.timeout(60_000) });
if (!response.ok) throw new Error(`Open-Meteo returned HTTP ${response.status}: ${await response.text()}`);
const payload = await response.json();
const results = Array.isArray(payload) ? payload : [payload];
if (results.length !== points.length) throw new Error(`Expected ${points.length} points, got ${results.length}.`);

const pack = {
  label,
  at,
  source,
  weatherSource: "Open-Meteo archived forecasts (historical-forecast-api)",
  points: points.map((point, index) => ({
    key: point.key,
    latitude: point.coordinates[0],
    longitude: point.coordinates[1],
    hourly: results[index].hourly,
    daily: results[index].daily,
  })),
};

const file = join(root, "data", "replay", `${at.slice(0, 10)}.json`);
mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, `${JSON.stringify(pack)}\n`);
console.log(`Saved ${points.length} points around ${at} to ${file.slice(root.length + 1)}`);
