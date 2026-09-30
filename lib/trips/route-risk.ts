import type { RiskKey, SafeGoLocation } from "../safego/types.ts";
import type { RouteCoverage, RouteRiskSegment } from "./types.ts";
import { isPilotLocation, PILOT } from "./pilot.ts";

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

const CALM_FACTORS = ["Weather", "Flood / roads", "Official advisories"];
const CALM_FACTOR_MAX_SCORE = 29;
const CALM_AREA_MAX_KM = 15;

/**
 * For routes without enough location-specific coverage: when every pilot location shows
 * calm weather, no flood/road issue and no advisory, and the whole route lies in the
 * pilot area, return the highest of those factor scores (a Low rating). Otherwise null.
 */
export function calmAreaScore(pilotLocations: SafeGoLocation[], route: Array<[number, number]>) {
  if (pilotLocations.length === 0) return null;
  const inArea = route.every((point) =>
    Math.min(...pilotLocations.map((location) => distanceKm(point, location.coordinates))) <= CALM_AREA_MAX_KM);
  if (!inArea) return null;
  let highest = 0;
  for (const location of pilotLocations) {
    // Only live factors can vouch for calm conditions; demo placeholders never count.
    const counted = location.risk.countedFactors;
    const factors = location.factors.filter((factor) =>
      CALM_FACTORS.includes(factor.name) && (!counted || counted.includes(factor.name)));
    if (factors.length < CALM_FACTORS.length || factors.some((factor) => factor.score > CALM_FACTOR_MAX_SCORE)) return null;
    highest = Math.max(highest, ...factors.map((factor) => factor.score));
  }
  return highest;
}

export function analyzeRouteSegments(
  routeCoordinates: Array<[number, number]>,
  locations: SafeGoLocation[],
) {
  if (routeCoordinates.length < 2 || routeCoordinates.some(([lat, lon]) =>
    !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180)) {
    throw new Error("A route with at least two valid coordinates is required.");
  }

  const pilotLocations = locations.filter(isPilotLocation);
  // Preserve every road bend; split long edges so sparse provider geometry does
  // not hide gaps. Cap work before allocating samples for unreasonable routes.
  const pieces = routeCoordinates.slice(1).map((end, index) =>
    Math.ceil(distanceKm(routeCoordinates[index], end) * 1000 / PILOT.sampleLengthMeters));
  if (pieces.reduce((sum, count) => sum + count, 0) > 50_000) {
    throw new Error("This route is too long for the current pilot.");
  }
  const sampled: Array<[number, number]> = [routeCoordinates[0]];
  routeCoordinates.slice(1).forEach((end, index) => {
    const start = routeCoordinates[index];
    for (let part = 1; part <= pieces[index]; part += 1) {
      sampled.push(part === pieces[index] ? end : [
        start[0] + (end[0] - start[0]) * part / pieces[index],
        start[1] + (end[1] - start[1]) * part / pieces[index],
      ]);
    }
  });
  const segments: RouteRiskSegment[] = [];
  let weightedRisk = 0;
  let totalDistance = 0;
  let coveredDistance = 0;
  let unknownGap = 0;
  let longestUnknownGapMeters = 0;
  let maximumRisk = 0;

  for (let index = 0; index < sampled.length - 1; index += 1) {
    const start = sampled[index];
    const end = sampled[index + 1];
    const center = midpoint(start, end);
    const nearest = pilotLocations
      .map((location) => ({
        location,
        distance: distanceKm(center, location.coordinates),
      }))
      .sort((first, second) => first.distance - second.distance)[0];
    const segmentDistanceMeters = distanceKm(start, end) * 1000;
    // Distance from the start plus full edge length conservatively bounds the
    // whole edge, not just its midpoint. Never claim coverage past the circle.
    // A location that is not rated (no live data) covers nothing.
    const covered = Boolean(nearest && nearest.location.risk.basis !== "none" &&
      distanceKm(start, nearest.location.coordinates) * 1000 + segmentDistanceMeters <= PILOT.radiusMeters);
    const score = covered ? nearest.location.risk.percentage : null;

    totalDistance += segmentDistanceMeters;
    if (score !== null) {
      coveredDistance += segmentDistanceMeters;
      weightedRisk += score * segmentDistanceMeters;
      maximumRisk = Math.max(maximumRisk, score);
      unknownGap = 0;
    } else {
      unknownGap += segmentDistanceMeters;
      longestUnknownGapMeters = Math.max(longestUnknownGapMeters, unknownGap);
    }
    const segment: RouteRiskSegment = {
      coordinates: [start, end],
      riskScore: score,
      riskKey: score === null ? "unknown" : routeRiskBand(score).key,
      basisLocationId: covered ? nearest.location.id : null,
      basisLocationName: covered ? nearest.location.name : null,
      lengthMeters: segmentDistanceMeters,
      coverage: covered ? "covered" : "unknown",
      nearestPointDistanceMeters: nearest ? nearest.distance * 1000 : null,
    };
    // A continuous polyline keeps dash patterns visible at low zoom and avoids
    // hundreds of independent Leaflet objects, while retaining every bend.
    const previous = segments.at(-1);
    if (previous && previous.basisLocationId === segment.basisLocationId && previous.riskScore === segment.riskScore) {
      previous.coordinates.push(end);
      previous.lengthMeters += segment.lengthMeters;
      previous.nearestPointDistanceMeters = previous.nearestPointDistanceMeters === null
        ? segment.nearestPointDistanceMeters
        : Math.max(previous.nearestPointDistanceMeters, segment.nearestPointDistanceMeters ?? 0);
    } else {
      segments.push(segment);
    }
  }

  if (totalDistance < 1) throw new Error("Choose two distinct route endpoints.");
  const ratio = coveredDistance / totalDistance;
  const sufficient = ratio * 100 >= PILOT.minimumCoveragePercent;
  const coverage: RouteCoverage = {
    pilotId: PILOT.id,
    status: sufficient ? "sufficient" : "insufficient",
    // Floor for display so rounding cannot imply that a failed gate passed.
    coveredPercent: Math.floor(ratio * 1000) / 10,
    minimumPercent: PILOT.minimumCoveragePercent,
    radiusMeters: PILOT.radiusMeters,
    totalMeters: totalDistance,
    coveredMeters: coveredDistance,
    unknownMeters: totalDistance - coveredDistance,
    longestUnknownGapMeters,
  };
  const calmScore = sufficient ? null : calmAreaScore(pilotLocations, routeCoordinates);
  const rawRiskScore = sufficient ? Math.round(weightedRisk / coveredDistance) : calmScore;
  let overallRiskScore = rawRiskScore;
  let safetyRule = "";
  if (overallRiskScore !== null && maximumRisk >= 80 && overallRiskScore < 80) {
    overallRiskScore = 80;
    safetyRule = "Critical route floor applied because part of the route is covered by a Critical risk point.";
  } else if (overallRiskScore !== null && maximumRisk >= 60 && overallRiskScore < 60) {
    overallRiskScore = 60;
    safetyRule = "High route floor applied because part of the route is covered by a High risk point.";
  }

  return {
    segments,
    rawRiskScore,
    overallRiskScore,
    safetyRule,
    coverage,
    calmEstimate: calmScore !== null,
  };
}
