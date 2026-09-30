// Starts SafeGo for a presentation: the production web build plus the Java API, then opens the browser.
//
//   npm run presentation            build if needed, start, open http://localhost:3000
//   npm run presentation:offline    same, with live weather and PAGASA alerts turned off
//   npm run presentation:build      build ahead of time (web + Java) and exit
//
// Flags: --offline, --rebuild (force a fresh web build), --build-only, --no-open.
import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, readdirSync, rmSync, statSync } from "node:fs";
import net from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const windows = process.platform === "win32";
const args = new Set(process.argv.slice(2));
const offline = args.has("--offline");
const buildOnly = args.has("--build-only");
const nextBin = join(root, "node_modules", "next", "dist", "bin", "next");
const standalone = join(root, ".next", "standalone");
const server = join(standalone, "server.js");
const buildId = join(root, ".next", "BUILD_ID");
const url = "http://localhost:3000";

for (const file of [".env.local", ".env"]) {
  const path = join(root, file);
  if (existsSync(path)) process.loadEnvFile(path);
}
if (offline) {
  process.env.SAFEGO_DATA_MODE = "mock";
  process.env.SAFEGO_WEATHER_PROVIDER = "disabled";
  process.env.SAFEGO_PAGASA_CAP_FEED_URL = "disabled";
  process.env.SAFEGO_DEMO_ROUTE_FALLBACK = "true";
}

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

if (!existsSync(nextBin)) fail("SafeGo's packages are not installed. Run npm install in the project folder first.");

async function responds(target) {
  try {
    const response = await fetch(target, { signal: AbortSignal.timeout(2_000) });
    return response.ok;
  } catch {
    return false;
  }
}

function portFree(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", () => resolve(false));
    probe.once("listening", () => probe.close(() => resolve(true)));
    probe.listen(port, "127.0.0.1");
  });
}

function openBrowser() {
  if (args.has("--no-open")) return;
  const [command, commandArgs] = windows ? ["cmd.exe", ["/c", "start", "", url]]
    : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
  spawn(command, commandArgs, { stdio: "ignore", detached: true }).unref();
}

// The newest source change, to decide whether the production build is out of date.
function newestChange(paths) {
  let newest = 0;
  const visit = (path) => {
    if (!existsSync(path)) return;
    const stats = statSync(path);
    if (stats.isDirectory()) {
      for (const entry of readdirSync(path)) {
        if (entry !== "node_modules" && !entry.startsWith(".")) visit(join(path, entry));
      }
    } else {
      newest = Math.max(newest, stats.mtimeMs);
    }
  };
  paths.forEach((path) => visit(join(root, path)));
  return newest;
}

function buildIsCurrent() {
  if (!existsSync(server) || !existsSync(buildId)) return false;
  const built = statSync(buildId).mtimeMs;
  return newestChange(["app", "components", "lib", "public", "next.config.ts", "package.json", "tsconfig.json", "postcss.config.mjs"]) <= built;
}

function run(command, commandArgs, label) {
  console.log(`\n${label}…`);
  const result = spawnSync(command, commandArgs, { cwd: root, stdio: "inherit", env: process.env });
  if (result.status !== 0) fail(`${label} failed. Read the messages above, fix the problem, then run this again.`);
}

// --- already running? ---
if (!buildOnly) {
  const [webUp, apiUp] = await Promise.all([responds(url), responds("http://127.0.0.1:8080/api/health")]);
  if (webUp && apiUp) {
    console.log(`\nSafeGo is already running: ${url}\nTo restart it, run npm run stop first.\n`);
    openBrowser();
    process.exit(0);
  }
  const [webFree, apiFree] = await Promise.all([portFree(3000), portFree(8080)]);
  if (!webFree || !apiFree) {
    fail(`Port ${!webFree ? 3000 : 8080} is in use by an older SafeGo or another program.\nRun npm run stop, then run this again.`);
  }
}

// --- build the web app when needed ---
if (args.has("--rebuild") || !buildIsCurrent()) {
  run(process.execPath, [nextBin, "build"], "Building the SafeGo web app (about a minute)");
} else {
  console.log("\nThe SafeGo web build is up to date.");
}
// The standalone server needs the public files and static assets next to it.
rmSync(join(standalone, "public"), { recursive: true, force: true });
cpSync(join(root, "public"), join(standalone, "public"), { recursive: true });
rmSync(join(standalone, ".next", "static"), { recursive: true, force: true });
cpSync(join(root, ".next", "static"), join(standalone, ".next", "static"), { recursive: true });

if (buildOnly) {
  const gradle = windows ? ["cmd.exe", ["/d", "/s", "/c", ".\\gradlew.bat bootJar"]] : ["./gradlew", ["bootJar"]];
  const java = spawnSync(process.execPath, [join(root, "scripts", "java-api.mjs"), "--check"], { encoding: "utf8" });
  if (java.status !== 0) fail(java.stderr || "JDK 21 was not found.");
  console.log("\nBuilding the SafeGo Java API…");
  const result = spawnSync(gradle[0], gradle[1], {
    cwd: join(root, "server", "demo"), stdio: "inherit", env: { ...process.env, JAVA_HOME: java.stdout.trim() },
  });
  if (result.status !== 0) fail("Building the Java API failed. Read the messages above.");
  console.log("\nSafeGo is built. Start it with npm run presentation (or double-click Start SafeGo.cmd).\n");
  process.exit(0);
}

// --- start both servers ---
console.log(offline
  ? "\nStarting SafeGo in OFFLINE mode: stored demo conditions, no live weather or PAGASA alerts."
  : "\nStarting SafeGo (production build)…");
const children = [
  spawn(process.execPath, [join(root, "scripts", "java-api.mjs")], { cwd: root, stdio: "inherit", env: process.env }),
  spawn(process.execPath, [server], {
    cwd: standalone,
    stdio: ["ignore", "ignore", "inherit"],
    env: { ...process.env, PORT: "3000", HOSTNAME: "0.0.0.0", NODE_ENV: "production" },
  }),
];

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.pid || child.exitCode !== null) continue;
    if (windows) spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    else child.kill("SIGTERM");
  }
  process.exitCode = code;
}
for (const child of children) {
  child.on("error", (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on("exit", (code) => {
    if (!stopping) {
      console.error("\nA SafeGo server stopped unexpectedly. Read the messages above, then run npm run presentation again.");
      stop(code ?? 1);
    }
  });
}
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

async function waitFor(target) {
  for (let attempt = 0; attempt < 360 && !stopping; attempt += 1) {
    if (await responds(target)) return true;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

const [webReady, apiReady] = await Promise.all([waitFor(url), waitFor("http://127.0.0.1:8080/api/health")]);
if (webReady && apiReady) {
  console.log(`\n==============================================\n  SafeGo is ready: ${url}\n  Press Ctrl+C in this window to stop it.\n==============================================\n`);
  openBrowser();
} else if (!stopping) {
  console.error("\nSafeGo did not start in time. Read the Java and web messages above, then run npm run stop and try again.");
  stop(1);
}
