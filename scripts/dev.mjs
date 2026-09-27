import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import net from "node:net";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const windows = process.platform === "win32";
const requiredPaths = [
  join(root, "node_modules", "next", "dist", "bin", "next"),
  join(root, "server", "demo", windows ? "gradlew.bat" : "gradlew"),
];

for (const requiredPath of requiredPaths) {
  if (!existsSync(requiredPath)) {
    console.error("SafeGo is not ready to start. Run npm install from the project root first.");
    process.exit(1);
  }
}

function portAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, "127.0.0.1");
  });
}

for (const port of [3000, 8080]) {
  if (!await portAvailable(port)) {
    console.error(`SafeGo cannot start because port ${port} is already in use. Stop the older demo process and run npm run dev again.`);
    process.exit(1);
  }
}

const children = [
  spawn(process.execPath, [join(root, "scripts", "java-api.mjs")], { cwd: root, stdio: "inherit" }),
  spawn(process.execPath, [join(root, "node_modules", "next", "dist", "bin", "next"), "dev"], { cwd: root, stdio: "inherit" }),
];

let stopping = false;

async function waitFor(url) {
  for (let attempt = 0; attempt < 240 && !stopping; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_500) });
      if (response.ok) return true;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

Promise.all([
  waitFor("http://127.0.0.1:3000"),
  waitFor("http://127.0.0.1:8080/api/health"),
]).then(([webReady, apiReady]) => {
  if (webReady && apiReady) {
    console.log("\nSafeGo is ready: http://localhost:3000");
    if (process.env.SAFEGO_WEATHER_PROVIDER === "disabled") {
      console.log("Offline demo mode: stored conditions and the saved example route are in use.");
    }
  } else if (!stopping) {
    console.error("SafeGo startup timed out. Check the Java and Next.js messages above.");
  }
});
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
