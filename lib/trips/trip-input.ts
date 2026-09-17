type TripInputResult =
  | { ok: true; data: { origin: string; destination: string; preferSavedDemo: boolean } }
  | { ok: false; code: string; message: string };

export function parseTripInput(value: unknown): TripInputResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, code: "INVALID_TRIP", message: "The trip body must be a JSON object." };
  }
  const body = value as Record<string, unknown>;
  const origin = typeof body.origin === "string" ? body.origin.trim() : "";
  const destination = typeof body.destination === "string" ? body.destination.trim() : "";
  if (!origin || !destination || origin.length > 160 || destination.length > 160) {
    return { ok: false, code: "INVALID_TRIP", message: "Enter an origin and destination of 160 characters or fewer." };
  }
  if (origin.toLocaleLowerCase() === destination.toLocaleLowerCase()) {
    return { ok: false, code: "SAME_LOCATION", message: "Origin and destination must be different." };
  }
  return { ok: true, data: { origin, destination, preferSavedDemo: body.preferSavedDemo === true } };
}
