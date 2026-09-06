import { dataResponse, dataServiceError } from "@/lib/data/api-response";
import { getDashboardSnapshot } from "@/lib/data/dashboard-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { backend, snapshot } = await getDashboardSnapshot();
    return dataResponse(snapshot, backend);
  } catch (error) {
    return dataServiceError(error);
  }
}
