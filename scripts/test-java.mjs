import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cwd = join(root, "server", "demo");
const windows = process.platform === "win32";
const command = windows ? "cmd.exe" : "./gradlew";
const args = windows ? ["/d", "/s", "/c", "gradlew.bat test"] : ["test"];

const result = spawnSync(command, args, {
  cwd,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
