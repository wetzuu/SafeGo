import { dataResponse, dataServiceError } from "@/lib/data/api-response";
import { getRepository } from "@/lib/data/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { backend, repository } = getRepository();
    return dataResponse(await repository.listLocations(), backend);
  } catch (error) {
    return dataServiceError(error);
  }
}
