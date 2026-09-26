import { spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, rmSync } from "node:fs";
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
let result = spawnSync("pg_dump", ["--format=custom", "--no-owner", "--no-privileges", "--file", output], {
  env: { ...process.env, PGDATABASE: databaseUrl },
  stdio: "inherit",
  windowsHide: true,
});

if (result.error?.code === "ENOENT") {
  const localDocker = process.platform === "win32" && process.env.LOCALAPPDATA
    ? join(process.env.LOCALAPPDATA, "Programs", "DockerDesktop", "resources", "bin", "docker.exe")
    : "docker";
  const docker = existsSync(localDocker) ? localDocker : "docker";
  const parsed = new URL(databaseUrl);
  if (!["localhost", "127.0.0.1"].includes(parsed.hostname)) {
    throw new Error("pg_dump was not found. Install PostgreSQL client tools to back up a hosted database.");
  }

  const file = openSync(output, "wx");
  try {
    result = spawnSync(docker, [
      "compose", "exec", "-T", "database", "pg_dump",
      "--username", decodeURIComponent(parsed.username),
      "--dbname", parsed.pathname.slice(1),
      "--format=custom", "--no-owner", "--no-privileges",
    ], {
      cwd: process.cwd(),
      stdio: ["ignore", file, "inherit"],
      windowsHide: true,
    });
  } finally {
    closeSync(file);
  }
}
if (result.status !== 0) {
  if (existsSync(output)) rmSync(output);
  throw new Error(`Database backup failed with exit code ${result.status ?? "unknown"}.`);
}

console.log(`Backup created: ${output}`);
