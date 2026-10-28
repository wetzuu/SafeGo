import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Runs the weather backtest. Pass --offline to rebuild from the saved responses only.
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cwd = join(root, "server", "demo");
const extra = process.argv.slice(2).join(" ");
const task = ["backtest", "--quiet", ...(extra ? [`-PbacktestArgs=${extra}`] : [])];
const windows = process.platform === "win32";
const command = windows ? "cmd.exe" : "./gradlew";
const args = windows ? ["/d", "/s", "/c", ".\\gradlew.bat " + task.join(" ")] : task;

const result = spawnSync(command, args, { cwd, stdio: "inherit" });
process.exit(result.status ?? 1);
