import { analyzeTrip } from "@/lib/trips/trip-service";
import { NextResponse } from "next/server";

import { parseTripInput } from "@/lib/trips/trip-input";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Send a valid JSON request body." } },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const input = parseTripInput(body);
    if (!input.ok) {
      return NextResponse.json(
        { error: { code: input.code, message: input.message } },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    const { origin, destination, preferSavedDemo } = input.data;
    const { analysis, backend } = await analyzeTrip(origin, destination, { preferSavedDemo });
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
