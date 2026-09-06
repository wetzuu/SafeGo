import { dataResponse, dataServiceError } from "@/lib/data/api-response";
import { getRepository } from "@/lib/data/repository";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const { backend, repository } = getRepository();
    const location = await repository.getLocationRisk(id);

    if (!location) {
      return NextResponse.json(
        {
          error: {
            code: "LOCATION_NOT_FOUND",
            message: "That SafeGo location was not found.",
          },
        },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    return dataResponse(location, backend);
  } catch (error) {
    return dataServiceError(error);
  }
}
