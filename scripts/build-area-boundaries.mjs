// Builds public/data/ncr-areas.json: the Metro Manila areas the risk map shades.
//
// Sources
// - Barangays outside the City of Manila: PSA/NAMRIA boundaries (PSGC, 31 Dec 2023) from
//   https://github.com/faeldon/philippines-json-maps (MIT). That dataset has no barangays for Manila.
// - City of Manila districts: OpenStreetMap via Nominatim (© OpenStreetMap contributors, ODbL).
//
// Run with: npm run data:boundaries
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "public", "data", "ncr-areas.json");
const USER_AGENT = "SafeGo-boundary-build/1.0 (https://github.com/)";
const PSA_BASE = "https://raw.githubusercontent.com/faeldon/philippines-json-maps/master/2023/geojson";
const NCR_DISTRICTS = ["1303900000", "1307400000", "1307500000", "1307600000"];
const MANILA_PSGC = 1380600000;
const MANILA_DISTRICTS = [
  "Binondo", "Ermita", "Intramuros", "Malate", "Paco", "Pandacan", "Port Area",
  "Quiapo", "Sampaloc", "San Andres", "San Miguel", "San Nicolas", "Santa Ana", "Santa Cruz", "Tondo",
];

async function getJson(url) {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
  if (!response.ok) throw new Error(`${response.status} for ${url}`);
  return response.json();
}

const round = (value) => Math.round(value * 1e5) / 1e5;

function roundGeometry(geometry) {
  if (!geometry) return null;
  const ring = (points) => points.map(([lon, lat]) => [round(lon), round(lat)]);
  if (geometry.type === "Polygon") return { type: "Polygon", coordinates: geometry.coordinates.map(ring) };
  if (geometry.type === "MultiPolygon") return { type: "MultiPolygon", coordinates: geometry.coordinates.map((polygon) => polygon.map(ring)) };
  return null;
}

async function psaBarangays() {
  const cityNames = new Map();
  for (const district of NCR_DISTRICTS) {
    const cities = await getJson(`${PSA_BASE}/provdists/medres/municities-provdist-${district}.0.01.json`);
    for (const feature of cities.features) cityNames.set(feature.properties.adm3_psgc, feature.properties.adm3_en);
  }

  const areas = [];
  for (const psgc of cityNames.keys()) {
    if (psgc === MANILA_PSGC) continue;
    const barangays = await getJson(`${PSA_BASE}/municities/medres/bgysubmuns-municity-${psgc}.0.01.json`);
    for (const feature of barangays.features ?? []) {
      const geometry = roundGeometry(feature.geometry);
      if (!geometry) continue;
      areas.push({ name: feature.properties.adm4_en, city: cityNames.get(psgc), level: "barangay", geometry });
    }
    console.log(`${cityNames.get(psgc)}: ${barangays.features?.length ?? 0} barangays`);
  }
  return areas;
}

async function manilaDistricts() {
  const areas = [];
  for (const district of MANILA_DISTRICTS) {
    // Nominatim allows at most one request per second.
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const query = new URLSearchParams({
      q: `${district}, Manila`,
      format: "jsonv2",
      polygon_geojson: "1",
      polygon_threshold: "0.00005",
      countrycodes: "ph",
      limit: "5",
    });
    const results = await getJson(`https://nominatim.openstreetmap.org/search?${query}`);
    const match = results.find((result) =>
      result.category === "boundary" && result.type === "administrative" && / Manila,/.test(result.display_name));
    const geometry = match && roundGeometry(match.geojson);
    if (!geometry) {
      console.warn(`Manila district not found: ${district}`);
      continue;
    }
    areas.push({ name: district, city: "City of Manila", level: "district", geometry });
    console.log(`Manila: ${district}`);
  }
  return areas;
}

const areas = [...await psaBarangays(), ...await manilaDistricts()];
const collection = {
  type: "FeatureCollection",
  attribution: "Barangays: PSA/NAMRIA via faeldon/philippines-json-maps (MIT). Manila districts: © OpenStreetMap contributors (ODbL).",
  features: areas.map(({ geometry, ...properties }) => ({ type: "Feature", properties, geometry })),
};
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(collection));
console.log(`Wrote ${areas.length} areas to ${output}`);
