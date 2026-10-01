// Builds public/data/ncr-areas.json: the 17 Metro Manila cities/municipalities the risk map shades.
//
// Source: PSA/NAMRIA boundaries via faeldon/philippines-json-maps (MIT).
// Run with: npm run data:boundaries
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "lib", "data", "ncr-cities.json");
const USER_AGENT = "SafeGo-boundary-build/1.0 (https://github.com/)";
const PSA_BASE = "https://raw.githubusercontent.com/faeldon/philippines-json-maps/master/2023/geojson";
const NCR_DISTRICTS = ["1303900000", "1307400000", "1307500000", "1307600000"];

async function getJson(url) {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
  if (!response.ok) throw new Error(`${response.status} for ${url}`);
  return response.json();
}

const round = (value) => Math.round(value * 1e5) / 1e5;

function areaKm2(geometry) {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  const ringArea = (ring) => {
    const latitude = (ring[0][1] * Math.PI) / 180;
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
  if (geometry.type === "MultiPolygon") return { type: "MultiPolygon", coordinates: geometry.coordinates.map((poly) => poly.map(ring)) };
  return null;
}

async function ncrCities() {
  const areas = [];
  for (const district of NCR_DISTRICTS) {
    const data = await getJson(`${PSA_BASE}/provdists/hires/municities-provdist-${district}.0.1.json`);
    for (const feature of data.features ?? []) {
      const geometry = roundGeometry(feature.geometry);
      if (!geometry) continue;
      const name = feature.properties.adm3_en;
      areas.push({
        name,
        city: name,
        level: "city",
        psgc: String(feature.properties.adm3_psgc),
        areaKm2: Math.round(areaKm2(geometry) * 100) / 100,
        geometry,
      });
      console.log(`City: ${name} (${feature.geometry.type})`);
    }
  }
  return areas;
}

const areas = await ncrCities();
const collection = {
  type: "FeatureCollection",
  attribution: "PSA/NAMRIA via faeldon/philippines-json-maps (MIT).",
  features: areas.map(({ geometry, ...properties }) => ({ type: "Feature", properties, geometry })),
};
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(collection));
console.log(`Wrote ${areas.length} cities to ${output}`);
