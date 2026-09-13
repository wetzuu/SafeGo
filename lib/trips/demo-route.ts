/**
 * Saved OSRM geometry for the built-in España-to-Lerma demo.
 *
 * This is a resilience fallback, not live routing. It is used only when the
 * public routing provider is unavailable and both endpoints exactly match the
 * documented example. Coordinates were captured from the OSRM demo service on
 * 2026-09-14 and remain subject to OpenStreetMap attribution.
 */
const ESPANA: [number, number] = [14.612, 120.9902];
const LERMA: [number, number] = [14.6049, 120.9888];

const ESPANA_TO_LERMA: Array<[number, number]> = [
  [14.612167, 120.990381],
  [14.611941, 120.990603],
  [14.611887, 120.990655],
  [14.611788, 120.990755],
  [14.611396, 120.991132],
  [14.611344, 120.991183],
  [14.610699, 120.991798],
  [14.610463, 120.992028],
  [14.61003, 120.992445],
  [14.609809, 120.992658],
  [14.609731, 120.992738],
  [14.609648, 120.992821],
  [14.609593, 120.992872],
  [14.609105, 120.993325],
  [14.608999, 120.993307],
  [14.608912, 120.993303],
  [14.608099, 120.993278],
  [14.608011, 120.993275],
  [14.607935, 120.993192],
  [14.607909, 120.993165],
  [14.607701, 120.992934],
  [14.607513, 120.992723],
  [14.607254, 120.992434],
  [14.607011, 120.992172],
  [14.606766, 120.991909],
  [14.606734, 120.991872],
  [14.606524, 120.991637],
  [14.606314, 120.991404],
  [14.606038, 120.991097],
  [14.605542, 120.990557],
  [14.605282, 120.990275],
  [14.605052, 120.990016],
  [14.604856, 120.989801],
  [14.60472, 120.989649],
  [14.604575, 120.989481],
  [14.605074, 120.988988],
];

const ROAD_NAMES = [
  "A. H. Lacson Avenue",
  "M. Earnshaw Street",
  "S. H. Loyola Street",
  "Padre Campa Street",
];

function samePoint(first: [number, number], second: [number, number]) {
  return Math.abs(first[0] - second[0]) < 0.000001
    && Math.abs(first[1] - second[1]) < 0.000001;
}

export function findSavedDemoRoute(
  origin: [number, number],
  destination: [number, number],
) {
  const forward = samePoint(origin, ESPANA) && samePoint(destination, LERMA);
  const reverse = samePoint(origin, LERMA) && samePoint(destination, ESPANA);
  if (!forward && !reverse) return null;

  return {
    routeCoordinates: (reverse ? ESPANA_TO_LERMA.slice().reverse() : ESPANA_TO_LERMA)
      .map(([latitude, longitude]) => [latitude, longitude] as [number, number]),
    roadNames: [...ROAD_NAMES],
    routingSource: "saved-demo" as const,
  };
}
