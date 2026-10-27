/** A place SafeGo can rate: where it is and what people call it. No conditions are stored here. */
export interface LocationAnchor {
  id: string;
  name: string;
  city: string;
  aliases: string[];
  /** [latitude, longitude] */
  coordinates: [number, number];
}

/**
 * The places SafeGo rates. Every condition, alert and report comes from live sources at run time;
 * nothing here is a reading. Synthetic values for tests live in tests/fixtures/seeded-locations.ts.
 */
export const LOCATION_ANCHORS: LocationAnchor[] = [
  { id: "espana", name: "España Blvd., Sampaloc", city: "Manila", aliases: ["espana", "españa", "sampaloc", "morayta"], coordinates: [14.612, 120.9902] },
  { id: "mapua-makati", name: "Mapúa University, Makati", city: "Makati", aliases: ["mapua", "mapúa", "makati", "mapua makati", "campus"], coordinates: [14.5665, 121.02] },
  { id: "quiapo", name: "Quiapo underpass", city: "Manila", aliases: ["quiapo", "underpass", "quezon bridge"], coordinates: [14.5995, 120.9842] },
  { id: "lerma", name: "Lerma St., Sampaloc", city: "Manila", aliases: ["lerma", "sampaloc"], coordinates: [14.6049, 120.9888] },
  { id: "ortigas-pasig", name: "Ortigas Center, Pasig", city: "Pasig", aliases: ["ortigas", "pasig", "ortigas center", "kapitolyo"], coordinates: [14.5869, 121.0614] },
  { id: "marikina-riverbanks", name: "Marikina Riverbanks, Marikina", city: "Marikina", aliases: ["marikina", "riverbanks", "marikina river", "tumana", "provident"], coordinates: [14.6346, 121.0963] },
  { id: "malabon-dampalit", name: "C-4 Road / Dampalit, Malabon", city: "Malabon", aliases: ["malabon", "dampalit", "c4", "tullahan", "concepcion", "hulong duhat"], coordinates: [14.6645, 120.9575] },
  { id: "navotas-nbbs", name: "North Bay Blvd. South (NBBS), Navotas", city: "Navotas", aliases: ["navotas", "nbbs", "r10", "fish port", "san rafael"], coordinates: [14.6441, 120.9535] },
  { id: "valenzuela-malinta", name: "MacArthur Highway, Malinta, Valenzuela", city: "Valenzuela", aliases: ["valenzuela", "malinta", "macarthur", "dalandanan", "karuhatan"], coordinates: [14.6933, 120.9634] },
  { id: "qc-araneta", name: "G. Araneta Ave. / Talayan, Quezon City", city: "Quezon City", aliases: ["araneta", "talayan", "tatalon", "quezon city", "qc", "maria clara", "e rodriguez"], coordinates: [14.6385, 121.003] },
  { id: "mandaluyong-maysilo", name: "Maysilo Circle, Mandaluyong", city: "Mandaluyong", aliases: ["mandaluyong", "maysilo", "boni", "plainview", "city hall"], coordinates: [14.5772, 121.0347] },
  { id: "san-juan-river", name: "F. Manalo / San Juan River, San Juan", city: "San Juan", aliases: ["san juan", "manalo", "san juan river", "batis", "progreso"], coordinates: [14.6042, 121.0267] },
  { id: "paranaque-sucat", name: "Dr. A. Santos Ave. (Sucat), Parañaque", city: "Parañaque", aliases: ["paranaque", "parañaque", "sucat", "kabihasnan", "santos"], coordinates: [14.4988, 120.9882] },
  { id: "pasay-rotonda", name: "Taft Ave. / EDSA Rotonda, Pasay", city: "Pasay", aliases: ["pasay", "rotonda", "taft", "edsa", "baclaran", "malibay"], coordinates: [14.5378, 120.9995] },
  { id: "taguig-c6", name: "C-6 Road / Hagonoy, Taguig", city: "Taguig", aliases: ["taguig", "c6", "hagonoy", "lakeshore", "lower bicutan"], coordinates: [14.5098, 121.0742] },
  { id: "laspinas-zapote", name: "Alabang–Zapote Road, Zapote, Las Piñas", city: "Las Piñas", aliases: ["las pinas", "las piñas", "zapote", "alabang zapote", "talaba"], coordinates: [14.4635, 120.9765] },
  { id: "muntinlupa-bayanan", name: "National Road, Bayanan, Muntinlupa", city: "Muntinlupa", aliases: ["muntinlupa", "bayanan", "alabang", "putatan", "poblacion"], coordinates: [14.4081, 121.0415] },
  { id: "caloocan-monumento", name: "Monumento / Samson Road, Caloocan", city: "Caloocan", aliases: ["caloocan", "kalookan", "monumento", "samson", "mcu", "edsa"], coordinates: [14.6575, 120.9836] },
];
