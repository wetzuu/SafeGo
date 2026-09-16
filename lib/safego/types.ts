export type RiskKey = "low" | "mod" | "high" | "crit";

export type FactorName =
  | "Weather"
  | "Flood / roads"
  | "Official advisories"
  | "School status"
  | "Community reports";

export type IconName = "weather" | "school" | "flood" | "alert" | "reports" | "clock" | "external" | "verified";
export type IconTone = "icon-weather" | "icon-ok" | "icon-mod" | "icon-alert" | "icon-neutral" | "icon-brand" | "";
export type ReportStatus = "verified" | "pending" | "unverified";
export type AdvisorySource = "gov" | "school" | "weather" | "community";

export interface RiskFactor {
  name: FactorName;
  score: number;
  pill: RiskKey;
  pillText: string;
  description: string;
  icon: IconName;
  tone: IconTone;
}

export interface RiskContribution {
  name: FactorName;
  score: number;
  weight: number;
  points: number;
}

export interface RiskAssessment {
  key: RiskKey;
  name: string;
  rank: string;
  percentage: number;
  rawScore: number;
  safetyRule: string;
  contributions: RiskContribution[];
  summary: string;
  status: string;
  modelVersion: string;
}

export interface Stat {
  label: string;
  value: string;
  detail: string;
  icon: IconName;
  tone: IconTone;
}

export interface Advisory {
  source: AdvisorySource;
  label: string;
  title: string;
  description: string;
  time: string;
  date?: string;
  sourceUrl?: string;
  isMock?: boolean;
}

export type UniversityOperatingStatus = "open" | "suspended" | "online" | "no-update";

export interface UniversityStatus {
  id: string;
  name: string;
  campus?: string;
  status: UniversityOperatingStatus;
  statusLabel: string;
  announcement: string;
  date: string;
  time: string;
  isMock: boolean;
  sourceName?: string;
  announcementUrl?: string;
  announcementVerified?: boolean;
}

export interface CommunityReport {
  type: string;
  title: string;
  meta: string;
  status: ReportStatus;
  statusLabel: string;
}

export interface RoutePoint {
  kind: "start" | "mid" | "end";
  label: string;
  name: string;
  detail: string;
}

export interface Hazard {
  title: string;
  meta: string;
  tone?: IconTone;
  sourceUrl?: string;
}

export interface LocationInput {
  id: string;
  name: string;
  city: string;
  aliases: string[];
  coordinates: [number, number];
  updated: string;
  riskSummary: string;
  riskStatus: string;
  stats: Stat[];
  factors: RiskFactor[];
  advisories: Advisory[];
  universities?: UniversityStatus[];
  reports: CommunityReport[];
  points: RoutePoint[];
  floods: Hazard[];
  hazards: Hazard[];
}

export interface SafeGoLocation extends Omit<LocationInput, "universities"> {
  universities: UniversityStatus[];
  risk: RiskAssessment;
}

export type MapLayerKey = "overall" | FactorName;

export interface MapLayer {
  key: MapLayerKey;
  label: string;
}

export type ScreenKey = "overview" | "risk" | "alerts" | "map" | "conditions" | "reports";
