import { analyzeTrip } from "@/lib/trips/trip-service";
import { NextResponse } from "next/server";

interface TripRequest {
  origin?: unknown;
  destination?: unknown;
  preferSavedDemo?: unknown;
}

export async function POST(request: Request) {
  let body: TripRequest;
  try {
    body = (await request.json()) as TripRequest;
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Send a valid JSON request body." } },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const origin = typeof body.origin === "string" ? body.origin.trim() : "";
    const destination =
      typeof body.destination === "string" ? body.destination.trim() : "";

    if (!origin || !destination || origin.length > 160 || destination.length > 160) {
      return NextResponse.json(
        { error: { code: "INVALID_TRIP", message: "Enter an origin and destination of 160 characters or fewer." } },
        { status: 400 },
      );
    }
    if (origin.toLocaleLowerCase() === destination.toLocaleLowerCase()) {
      return NextResponse.json(
        { error: { code: "SAME_LOCATION", message: "Origin and destination must be different." } },
        { status: 400 },
      );
    }

    const { analysis, backend } = await analyzeTrip(origin, destination, {
      preferSavedDemo: body.preferSavedDemo === true,
    });
    return NextResponse.json(
      { data: analysis, meta: { backend, generatedAt: analysis.generatedAt } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The trip could not be analyzed.";
    return NextResponse.json(
      { error: { code: "TRIP_ANALYSIS_FAILED", message } },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
