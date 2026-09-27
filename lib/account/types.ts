export interface SavedPlace {
  label: string;
  canonicalLabel: string;
  coordinates: [number, number];
  source: "preset" | "nominatim" | string;
  matchedLocationId: string | null;
  approximate: boolean;
}

export interface AccountProfile {
  email: string;
  name: string;
  home: string;
  school: string;
  homePlace: SavedPlace | null;
  schoolPlace: SavedPlace | null;
  persistence: "process" | "database";
}
