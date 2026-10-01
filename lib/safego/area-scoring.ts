import type { FeatureCollection, MultiPolygon, Polygon, Position } from "geojson";

export interface AreaProperties {
  name: string;
  city: string;
  level: "barangay" | "district" | "city";
  /** PSA geographic code; null for Manila districts, which come from OpenStreetMap. */
  psgc: string | null;
  areaKm2: number;
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

// Distance from a point to a segment, on a local flat projection around the point (metres).
function segmentDistanceMeters(point: [number, number], [lon1, lat1]: Position, [lon2, lat2]: Position) {
  const metersPerDegree = 111_320;
  const scaleX = Math.cos((point[0] * Math.PI) / 180) * metersPerDegree;
  const ax = (lon1 - point[1]) * scaleX;
  const ay = (lat1 - point[0]) * metersPerDegree;
  const bx = (lon2 - point[1]) * scaleX;
  const by = (lat2 - point[0]) * metersPerDegree;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared)) : 0;
  return Math.hypot(ax + t * dx, ay + t * dy);
}

/** Metres from a point to the nearest part of an area; 0 when the point is inside it. */
export function distanceToArea(geometry: AreaGeometry, point: [number, number]) {
  if (areaContains(geometry, point)) return 0;
  let nearest = Infinity;
  for (const polygon of polygons(geometry)) {
    for (const ring of polygon) {
      for (let i = 1; i < ring.length; i++) nearest = Math.min(nearest, segmentDistanceMeters(point, ring[i - 1], ring[i]));
    }
  }
  return nearest;
}

/**
 * An area takes the highest score among the SafeGo points within `radiusMeters` of any part of it,
 * so it never looks safer than its riskiest nearby reading. Areas with no nearby point return null:
 * they are not rated, which is different from low risk.
 */
export function scoreArea(geometry: AreaGeometry, points: ScoredPoint[], radiusMeters: number): AreaScore | null {
  let best: AreaScore | null = null;
  for (const point of points) {
    if (distanceToArea(geometry, point.coordinates) > radiusMeters) continue;
    if (!best || point.score > best.score) best = { score: point.score, sourceId: point.id };
  }
  return best;
}

/** The closest point to an area and how far it is, for explaining unrated areas. */
export function nearestPoint<T extends { coordinates: [number, number] }>(geometry: AreaGeometry, points: T[]) {
  let nearest: { point: T; distanceMeters: number } | null = null;
  for (const point of points) {
    const distance = distanceToArea(geometry, point.coordinates);
    if (!nearest || distance < nearest.distanceMeters) nearest = { point, distanceMeters: distance };
  }
  return nearest;
}
