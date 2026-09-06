import { loadEnvConfig } from "@next/env";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

loadEnvConfig(process.cwd());

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) {
  throw new Error("DATABASE_URL is required. Copy .env.example to .env.local first.");
}

const sql = postgres(connectionString, {
  max: 1,
  ...(process.env.DATABASE_SSL === "true" ? { ssl: "require" } : {}),
});
const migrationsDirectory = path.join(process.cwd(), "db", "migrations");

try {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  const files = (await readdir(migrationsDirectory))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  const applied = await sql<{ name: string }[]>`SELECT name FROM schema_migrations`;
  const appliedNames = new Set(applied.map((row) => row.name));

  for (const file of files) {
    if (appliedNames.has(file)) {
      console.log(`Already applied: ${file}`);
      continue;
    }

    const migration = await readFile(path.join(migrationsDirectory, file), "utf8");
    await sql.begin(async (transaction) => {
      await transaction.unsafe(migration);
      await transaction`INSERT INTO schema_migrations (name) VALUES (${file})`;
    });
    console.log(`Applied: ${file}`);
  }
} finally {
  await sql.end();
}
