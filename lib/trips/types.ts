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
  coverage: "covered" | "unknown";
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
}
