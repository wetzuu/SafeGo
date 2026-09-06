import type { RiskKey, SafeGoLocation } from "../safego/types.ts";
import type { RouteRiskSegment } from "./types.ts";

const EARTH_RADIUS_KM = 6371;

export function distanceKm(
  first: [number, number],
  second: [number, number],
) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(second[0] - first[0]);
  const longitudeDelta = radians(second[1] - first[1]);
  const firstLatitude = radians(first[0]);
  const secondLatitude = radians(second[0]);
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function routeRiskBand(score: number): {
  key: RiskKey;
  name: string;
} {
  if (score <= 29) return { key: "low", name: "LOW RISK" };
  if (score <= 59) return { key: "mod", name: "MODERATE RISK" };
  if (score <= 79) return { key: "high", name: "HIGH RISK" };
  return { key: "crit", name: "CRITICAL RISK" };
}

function midpoint(
  first: [number, number],
  second: [number, number],
): [number, number] {
  return [(first[0] + second[0]) / 2, (first[1] + second[1]) / 2];
}

export function analyzeRouteSegments(
  routeCoordinates: Array<[number, number]>,
  locations: SafeGoLocation[],
) {
  if (routeCoordinates.length < 2 || !locations.length) {
    throw new Error("A route and at least one SafeGo risk point are required.");
  }

  const step = Math.max(1, Math.ceil((routeCoordinates.length - 1) / 70));
  const sampled = routeCoordinates.filter(
    (_coordinate, index) => index % step === 0 || index === routeCoordinates.length - 1,
  );
  const segments: RouteRiskSegment[] = [];
  let weightedRisk = 0;
  let totalDistance = 0;
  let maximumRisk = 0;
  let maximumCoverageDistance = 0;

  for (let index = 0; index < sampled.length - 1; index += 1) {
    const start = sampled[index];
    const end = sampled[index + 1];
    const center = midpoint(start, end);
    const nearest = locations
      .map((location) => ({
        location,
        distance: distanceKm(center, location.coordinates),
      }))
      .sort((first, second) => first.distance - second.distance)[0];
    const segmentDistanceMeters = distanceKm(start, end) * 1000;
    const score = nearest.location.risk.percentage;

    totalDistance += segmentDistanceMeters;
    weightedRisk += score * segmentDistanceMeters;
    maximumRisk = Math.max(maximumRisk, score);
    maximumCoverageDistance = Math.max(maximumCoverageDistance, nearest.distance);
    segments.push({
      coordinates: [start, end],
      distanceMeters: segmentDistanceMeters,
      riskScore: score,
      riskKey: routeRiskBand(score).key,
      basisLocationId: nearest.location.id,
      basisLocationName: nearest.location.name,
      distanceFromRiskPointKm: nearest.distance,
    });
  }

  const rawRiskScore = Math.round(weightedRisk / Math.max(totalDistance, 1));
  let overallRiskScore = rawRiskScore;
  let safetyRule = "";
  if (maximumRisk >= 80 && overallRiskScore < 80) {
    overallRiskScore = 80;
    safetyRule = "Critical route floor applied because part of the route is covered by a Critical risk point.";
  } else if (maximumRisk >= 60 && overallRiskScore < 60) {
    overallRiskScore = 60;
    safetyRule = "High route floor applied because part of the route is covered by a High risk point.";
  }

  return {
    segments,
    rawRiskScore,
    overallRiskScore,
    safetyRule,
    maximumCoverageDistance,
    totalDistanceMeters: totalDistance,
  };
}
