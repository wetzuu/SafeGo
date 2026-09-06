import type { RepositoryContext } from "./contracts.ts";
import { hasDatabaseConfiguration } from "./database.ts";
import { MockSafeGoRepository } from "./mock-repository.ts";
import { PostgresSafeGoRepository } from "./postgres-repository.ts";

export function getRepository(): RepositoryContext {
  const configuredMode = process.env.SAFEGO_DATA_MODE?.trim().toLowerCase();
  const mode = configuredMode || "auto";

  if (!new Set(["auto", "mock", "database"]).has(mode)) {
    throw new Error(
      "SAFEGO_DATA_MODE must be one of: auto, mock, or database.",
    );
  }

  if (mode === "database" && !hasDatabaseConfiguration()) {
    throw new Error(
      "DATABASE_URL is required when SAFEGO_DATA_MODE is set to database.",
    );
  }

  const useDatabase =
    mode === "database" || (mode === "auto" && hasDatabaseConfiguration());

  return useDatabase
    ? { backend: "database", repository: new PostgresSafeGoRepository() }
    : { backend: "mock", repository: new MockSafeGoRepository() };
}
