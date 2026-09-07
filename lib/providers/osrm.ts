import "server-only";

const DEFAULT_ENDPOINT = "https://router.project-osrm.org";

interface OsrmRouteResponse {
  code: string;
  message?: string;
  routes?: Array<{
    geometry: {
      type: "LineString";
      coordinates: Array<[number, number]>;
    };
    legs: Array<{
      steps: Array<{ name?: string }>;
    }>;
  }>;
}

export async function fetchDrivingRoute(
  origin: [number, number],
  destination: [number, number],
) {
  const baseUrl = process.env.SAFEGO_ROUTING_BASE_URL || DEFAULT_ENDPOINT;
  const coordinates = `${origin[1]},${origin[0]};${destination[1]},${destination[0]}`;
  const parameters = new URLSearchParams({
    alternatives: "false",
    steps: "true",
    geometries: "geojson",
    overview: "full",
  });
  const response = await fetch(
    `${baseUrl}/route/v1/driving/${coordinates}?${parameters}`,
    { cache: "no-store", signal: AbortSignal.timeout(12_000) },
  );
  if (!response.ok) throw new Error(`Routing service returned HTTP ${response.status}.`);

  const payload = (await response.json()) as OsrmRouteResponse;
  const route = payload.routes?.[0];
  if (payload.code !== "Ok" || !route) {
    throw new Error(payload.message || "No drivable route was found.");
  }

  const routeCoordinates = route.geometry.coordinates.map(
    ([longitude, latitude]) => [latitude, longitude] as [number, number],
  );
  const roadNames = Array.from(
    new Set(
      route.legs.flatMap((leg) =>
        leg.steps.map((step) => step.name?.trim()).filter(Boolean) as string[],
      ),
    ),
  ).slice(0, 8);

  return {
    routeCoordinates,
    roadNames,
  };
}
