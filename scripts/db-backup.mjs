import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("DATABASE_URL is required. Add it to .env.local first.");

const backupDirectory = resolve(process.env.SAFEGO_BACKUP_DIR?.trim() || "backups");
if (!existsSync(backupDirectory)) mkdirSync(backupDirectory, { recursive: true });

const timestamp = new Date().toISOString().replaceAll(":", "-").replace(".", "-");
const output = join(backupDirectory, `safego-${timestamp}.dump`);
const result = spawnSync("pg_dump", ["--format=custom", "--no-owner", "--no-privileges", "--file", output], {
  env: { ...process.env, PGDATABASE: databaseUrl },
  stdio: "inherit",
  windowsHide: true,
});

if (result.error?.code === "ENOENT") {
  throw new Error("pg_dump was not found. Install PostgreSQL client tools or run the documented Docker backup command.");
}
if (result.status !== 0) throw new Error(`Database backup failed with exit code ${result.status ?? "unknown"}.`);

console.log(`Backup created: ${output}`);
