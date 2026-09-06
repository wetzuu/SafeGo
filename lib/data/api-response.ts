import { NextResponse } from "next/server";
import type { DataBackend } from "./contracts.ts";

export function dataResponse<T>(data: T, backend: DataBackend) {
  return NextResponse.json(
    {
      data,
      meta: {
        backend,
        generatedAt: new Date().toISOString(),
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export function dataServiceError(error: unknown) {
  console.error("SafeGo data service error", error);

  return NextResponse.json(
    {
      error: {
        code: "DATA_SERVICE_UNAVAILABLE",
        message: "SafeGo data is temporarily unavailable.",
      },
    },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
