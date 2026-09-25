import nextEnv from "@next/env";
import postgres from "postgres";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) {
  throw new Error("DATABASE_URL is required. Add it to .env.local first.");
}

const sql = postgres(connectionString, {
  max: 1,
  connect_timeout: 8,
  ...(process.env.DATABASE_SSL === "true" ? { ssl: "require" } : {}),
});

try {
  const [summary] = await sql<{
    postgis_version: string | null;
    migrations: number;
    locations: number;
    assessments: number;
    sources: number;
  }[]>`
    SELECT
      (SELECT extversion FROM pg_extension WHERE extname = 'postgis') AS postgis_version,
      (SELECT count(*)::int FROM schema_migrations) AS migrations,
      (SELECT count(*)::int FROM locations) AS locations,
      (SELECT count(*)::int FROM risk_assessments) AS assessments,
      (SELECT count(*)::int FROM data_sources) AS sources
  `;

  if (!summary?.postgis_version) throw new Error("PostGIS is not enabled.");
  if (summary.migrations < 3) throw new Error(`Expected at least 3 migrations; found ${summary.migrations}.`);
  if (summary.locations === 0 || summary.assessments === 0) {
    throw new Error("The database is connected but has not been seeded.");
  }

  console.log("SafeGo database is ready.");
  console.table({
    PostGIS: summary.postgis_version,
    migrations: summary.migrations,
    locations: summary.locations,
    assessments: summary.assessments,
    sources: summary.sources,
  });
} finally {
  await sql.end();
}
