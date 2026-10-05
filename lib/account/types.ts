export interface SavedPlace {
  label: string;
  canonicalLabel: string;
  coordinates: [number, number];
  source: "preset" | "nominatim" | string;
  matchedLocationId: string | null;
  approximate: boolean;
}

/** A place an account saved under its own name. */
export interface Bookmark {
  id: string;
  name: string;
  place: SavedPlace;
}

export interface AccountProfile {
  email: string;
  name: string;
  home: string;
  homePlace: SavedPlace | null;
  bookmarks: Bookmark[];
  persistence: "process" | "database";
}
