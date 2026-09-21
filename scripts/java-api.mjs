import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cwd = join(root, "server", "demo");
for (const file of [".env.local", ".env"]) {
  const path = join(root, file);
  if (existsSync(path)) process.loadEnvFile(path);
}
const windows = process.platform === "win32";
const command = windows ? "cmd.exe" : "./gradlew";
const args = windows ? ["/d", "/s", "/c", "gradlew.bat bootJar"] : ["bootJar"];
const build = spawn(command, args, {
  cwd,
  stdio: "inherit",
  env: process.env,
});

let server;
let stopping = false;
function stop() {
  stopping = true;
  if (server?.pid) {
    if (windows) spawn("taskkill", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore" });
    else server.kill("SIGTERM");
  }
  if (build.pid && !build.killed) build.kill();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

build.on("error", (error) => {
  console.error(`Could not start Java API: ${error.message}`);
  process.exitCode = 1;
});
build.on("exit", (code) => {
  if (stopping) return;
  if (code !== 0) { process.exitCode = code ?? 1; return; }
  const jar = join(cwd, "build", "libs", "demo-0.0.1-SNAPSHOT.jar");
  if (!existsSync(jar)) { console.error("Java API jar was not built."); process.exitCode = 1; return; }
  server = spawn("java", ["-jar", jar], { cwd, stdio: "inherit", env: process.env });
  server.on("error", (error) => { console.error(`Could not start Java API: ${error.message}`); process.exitCode = 1; });
  server.on("exit", (serverCode) => { process.exitCode = serverCode ?? 1; });
});
