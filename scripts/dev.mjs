import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const windows = process.platform === "win32";
const children = [
  spawn(process.execPath, [join(root, "scripts", "java-api.mjs")], { cwd: root, stdio: "inherit" }),
  spawn(process.execPath, [join(root, "node_modules", "next", "dist", "bin", "next"), "dev"], { cwd: root, stdio: "inherit" }),
];

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.killed || !child.pid) continue;
    if (windows) spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    else child.kill("SIGTERM");
  }
  process.exitCode = code;
}
for (const child of children) {
  child.on("error", (error) => { console.error(error.message); stop(1); });
  child.on("exit", (code) => { if (!stopping) stop(code ?? 1); });
}
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
