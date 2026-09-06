import type {
  Advisory,
  CommunityReport,
  Hazard,
  RiskKey,
  SafeGoLocation,
} from "../safego/types.ts";

export interface ResolvedPlace {
  label: string;
  coordinates: [number, number];
  source: "preset" | "nominatim";
  matchedLocationId: string | null;
  approximate: boolean;
}

export interface RouteRiskSegment {
  coordinates: Array<[number, number]>;
  distanceMeters: number;
  riskScore: number;
  riskKey: RiskKey;
  basisLocationId: string;
  basisLocationName: string;
  distanceFromRiskPointKm: number;
}

export interface TripAnalysis {
  origin: ResolvedPlace;
  destination: ResolvedPlace;
  distanceMeters: number;
  durationSeconds: number;
  routeCoordinates: Array<[number, number]>;
  roadNames: string[];
  segments: RouteRiskSegment[];
  overallRiskScore: number;
  rawRiskScore: number;
  riskKey: RiskKey;
  riskName: string;
  safetyRule: string;
  corridorLocations: SafeGoLocation[];
  advisories: Advisory[];
  reports: CommunityReport[];
  hazards: Hazard[];
  coverageNote: string;
  generatedAt: string;
  routingSource: "osrm";
}
