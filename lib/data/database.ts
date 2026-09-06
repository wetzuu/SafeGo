import postgres from "postgres";

let client: ReturnType<typeof postgres> | undefined;

export function hasDatabaseConfiguration() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function getDatabase() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is required when SAFEGO_DATA_MODE is set to database.",
    );
  }

  client ??= postgres(connectionString, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    ...(process.env.DATABASE_SSL === "true" ? { ssl: "require" } : {}),
  });

  return client;
}
