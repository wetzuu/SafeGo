import type {
  Advisory,
  CommunityReport,
  Hazard,
  RiskKey,
  SafeGoLocation,
} from "../safego/types.ts";
import type { SourceStatus } from "../data/contracts.ts";

export interface ResolvedPlace {
  label: string;
  coordinates: [number, number];
  source: "preset" | "nominatim";
  matchedLocationId: string | null;
  approximate: boolean;
}

export interface RouteRiskSegment {
  coordinates: Array<[number, number]>;
  riskScore: number | null;
  riskKey: RiskKey | "unknown";
  basisLocationId: string | null;
  basisLocationName: string | null;
  lengthMeters: number;
  /** "estimated": no SafeGo location nearby, scored from live weather and PAGASA alerts there. */
  coverage: "covered" | "estimated" | "unknown";
  nearestPointDistanceMeters: number | null;
}

export interface RouteCoverage {
  pilotId: string;
  status: "sufficient" | "insufficient";
  coveredPercent: number;
  minimumPercent: number;
  radiusMeters: number;
  totalMeters: number;
  coveredMeters: number;
  /** Distance scored by an area estimate rather than a SafeGo location (not sent by older APIs). */
  estimatedMeters?: number;
  unknownMeters: number;
  longestUnknownGapMeters: number;
}

export interface TripAnalysis {
  origin: ResolvedPlace;
  destination: ResolvedPlace;
  routeCoordinates: Array<[number, number]>;
  roadNames: string[];
  segments: RouteRiskSegment[];
  overallRiskScore: number | null;
  rawRiskScore: number | null;
  riskKey: RiskKey | "unknown";
  riskName: string;
  safetyRule: string;
  corridorLocations: SafeGoLocation[];
  advisories: Advisory[];
  reports: CommunityReport[];
  hazards: Hazard[];
  coverageNote: string;
  generatedAt: string;
  routingSource: "osrm" | "simulation";
  coverage: RouteCoverage;
  sources: SourceStatus[];
  /** "route-1" for the main route, "route-2"… for alternatives. Missing from older APIs. */
  routeId?: string;
  /** OSRM free-flow driving time: no traffic, flooding or closures. Compare routes with it; never show it as an arrival time. */
  durationSeconds?: number | null;
  distanceMeters?: number | null;
  /** Other road routes between the same places, as geometry for the browser to score. */
  alternatives?: RouteOption[];
}

/** An alternative road route returned with a trip, before SafeGo scores it. */
export interface RouteOption {
  routeId: string;
  routeCoordinates: Array<[number, number]>;
  roadNames: string[];
  durationSeconds: number | null;
  distanceMeters: number | null;
}
