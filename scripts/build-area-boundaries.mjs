// Builds public/data/ncr-areas.json: the Metro Manila areas the risk map shades.
//
// Sources
// - Barangays outside the City of Manila: PSA/NAMRIA boundaries (PSGC, 31 Dec 2023) from
//   https://github.com/faeldon/philippines-json-maps (MIT). That dataset has no barangays for Manila.
// - City of Manila districts: OpenStreetMap via Nominatim (© OpenStreetMap contributors, ODbL).
//
// Run with: npm run data:boundaries
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
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
  "Quiapo", "Sampaloc", "San Andres", "San Miguel", "San Nicolas", "Santa Ana", "Santa Cruz", "Santa Mesa", "Tondo",
];

async function getJson(url) {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
  if (!response.ok) throw new Error(`${response.status} for ${url}`);
  return response.json();
}

const round = (value) => Math.round(value * 1e5) / 1e5;

// Planar shoelace area on a local equirectangular projection; accurate enough for city districts.
function areaKm2(geometry) {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  const ringArea = (ring) => {
    const latitude = ring[0][1] * Math.PI / 180;
    const kmPerDegree = 111.32;
    let sum = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [x1, y1] = ring[j];
      const [x2, y2] = ring[i];
      sum += (x1 * Math.cos(latitude) * kmPerDegree) * (y2 * kmPerDegree) - (x2 * Math.cos(latitude) * kmPerDegree) * (y1 * kmPerDegree);
    }
    return Math.abs(sum) / 2;
  };
  return polygons.reduce((total, [outer, ...holes]) => total + ringArea(outer) - holes.reduce((sum, hole) => sum + ringArea(hole), 0), 0);
}

function roundGeometry(geometry) {
  if (!geometry) return null;
  const ring = (points) => points.map(([lon, lat]) => [round(lon), round(lat)]);
  if (geometry.type === "Polygon") return { type: "Polygon", coordinates: geometry.coordinates.map(ring) };
  if (geometry.type === "MultiPolygon") {
    const validPolys = geometry.coordinates.filter((poly) => areaKm2({ type: "Polygon", coordinates: poly }) >= 0.05);
    const coordinates = (validPolys.length ? validPolys : geometry.coordinates).map((polygon) => polygon.map(ring));
    if (coordinates.length === 1) return { type: "Polygon", coordinates: coordinates[0] };
    return { type: "MultiPolygon", coordinates };
  }
  return null;
}

async function psaBarangays() {
  const cityNames = new Map();
  for (const district of NCR_DISTRICTS) {
    const cities = await getJson(`${PSA_BASE}/provdists/hires/municities-provdist-${district}.0.1.json`);
    for (const feature of cities.features) cityNames.set(feature.properties.adm3_psgc, feature.properties.adm3_en);
  }

  const areas = [];
  for (const psgc of cityNames.keys()) {
    if (psgc === MANILA_PSGC) continue;
    const barangays = await getJson(`${PSA_BASE}/municities/hires/bgysubmuns-municity-${psgc}.0.1.json`);
    for (const feature of barangays.features ?? []) {
      const geometry = roundGeometry(feature.geometry);
      if (!geometry) continue;
      areas.push({
        name: feature.properties.adm4_en,
        city: cityNames.get(psgc),
        level: "barangay",
        psgc: String(feature.properties.adm4_psgc),
        areaKm2: Math.round(areaKm2(geometry) * 100) / 100,
        geometry,
      });
    }
    console.log(`${cityNames.get(psgc)}: ${barangays.features?.length ?? 0} barangays`);
  }
  return areas;
}

async function manilaDistricts() {
  if (existsSync(output)) {
    try {
      const existing = JSON.parse(await readFile(output, "utf8"));
      const cached = existing.features?.filter((f) => f.properties?.city === "City of Manila") ?? [];
      if (cached.length === MANILA_DISTRICTS.length) {
        return cached.map((f) => {
          const geometry = roundGeometry(f.geometry);
          return { ...f.properties, geometry, areaKm2: Math.round(areaKm2(geometry) * 100) / 100 };
        });
      }
    } catch {}
  }
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
      result.category === "boundary" && result.type === "administrative" && /, Manila, Capital District,/.test(result.display_name));
    const geometry = match && roundGeometry(match.geojson);
    if (!geometry) {
      console.warn(`Manila district not found: ${district}`);
      continue;
    }
    areas.push({ name: district, city: "City of Manila", level: "district", psgc: null, areaKm2: Math.round(areaKm2(geometry) * 100) / 100, geometry });
    console.log(`Manila: ${district} <- ${match.display_name}`);
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
