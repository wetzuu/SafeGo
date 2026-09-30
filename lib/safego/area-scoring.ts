import type { FeatureCollection, MultiPolygon, Polygon, Position } from "geojson";

export interface AreaProperties {
  name: string;
  city: string;
  level: "barangay" | "district";
}

export type AreaGeometry = Polygon | MultiPolygon;
export type AreaCollection = FeatureCollection<AreaGeometry, AreaProperties>;

export interface ScoredPoint {
  id: string;
  /** [latitude, longitude], matching SafeGoLocation.coordinates. */
  coordinates: [number, number];
  score: number;
}

export interface AreaScore {
  score: number;
  sourceId: string;
}

/** Ten classes of 10 points each, like a stepped choropleth legend. */
export const SCORE_CLASS_COUNT = 10;

export function scoreClass(score: number) {
  return Math.max(0, Math.min(SCORE_CLASS_COUNT - 1, Math.floor(score / 10)));
}

function polygons(geometry: AreaGeometry): Position[][][] {
  return geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
}

// GeoJSON positions are [longitude, latitude].
function ringContains(ring: Position[], [lat, lon]: [number, number]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function areaContains(geometry: AreaGeometry, point: [number, number]) {
  return polygons(geometry).some(([outer, ...holes]) =>
    ringContains(outer, point) && !holes.some((hole) => ringContains(hole, point)));
}

/** Vertex average of the largest outer ring: close enough to the middle for small urban areas. */
export function areaCenter(geometry: AreaGeometry): [number, number] {
  const outer = polygons(geometry)
    .map(([ring]) => ring)
    .reduce((largest, ring) => (ring.length > largest.length ? ring : largest));
  const sum = outer.reduce(([lat, lon], [x, y]) => [lat + y, lon + x], [0, 0]);
  return [sum[0] / outer.length, sum[1] / outer.length];
}

export function distanceMeters([lat1, lon1]: [number, number], [lat2, lon2]: [number, number]) {
  const radians = Math.PI / 180;
  const x = (lon2 - lon1) * radians * Math.cos(((lat1 + lat2) / 2) * radians);
  const y = (lat2 - lat1) * radians;
  return Math.hypot(x, y) * 6_371_000;
}

/**
 * An area takes the highest score among the SafeGo points inside it or within `radiusMeters`
 * of its centre, so it never looks safer than its riskiest nearby reading. Areas with no nearby
 * point return null: they are not rated, which is different from low risk.
 */
export function scoreArea(geometry: AreaGeometry, points: ScoredPoint[], radiusMeters: number): AreaScore | null {
  const center = areaCenter(geometry);
  let best: AreaScore | null = null;
  for (const point of points) {
    const near = areaContains(geometry, point.coordinates) || distanceMeters(center, point.coordinates) <= radiusMeters;
    if (near && (!best || point.score > best.score)) best = { score: point.score, sourceId: point.id };
  }
  return best;
}
