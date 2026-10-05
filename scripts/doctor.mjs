// Pre-presentation check: tools, packages, build, ports and internet access to SafeGo's live sources.
// Run with: npm run doctor
import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import net from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const results = [];
const check = (ok, label, detail, fix) => results.push({ ok, label, detail, fix });

// Tools and packages.
const nodeMajor = Number(process.versions.node.split(".")[0]);
check(nodeMajor >= 22, "Node.js", `v${process.versions.node}`, "Install Node.js 24 (LTS) from nodejs.org.");
check(existsSync(join(root, "node_modules", "next", "dist", "bin", "next")), "npm packages", "installed", "Run npm install.");
const java = spawnSync(process.execPath, [join(root, "scripts", "java-api.mjs"), "--check"], { encoding: "utf8" });
check(java.status === 0, "JDK 21", java.status === 0 ? java.stdout.trim() : "not found", "Install JDK 21 (Eclipse Temurin) and set JAVA_HOME.");
check(existsSync(join(root, "server", "demo", process.platform === "win32" ? "gradlew.bat" : "gradlew")), "Gradle wrapper", "present", "Restore server/demo from git.");

// Builds.
const buildId = join(root, ".next", "BUILD_ID");
const webBuilt = existsSync(join(root, ".next", "standalone", "server.js")) && existsSync(buildId);
check(webBuilt, "Web production build", webBuilt ? `built ${statSync(buildId).mtime.toLocaleString()}` : "missing",
  "Run npm run presentation:build (npm run presentation also builds it on first start).");
const jar = join(root, "server", "demo", "build", "libs", "demo-0.0.1-SNAPSHOT.jar");
check(existsSync(jar), "Java API build", existsSync(jar) ? `built ${statSync(jar).mtime.toLocaleString()}` : "missing",
  "Run npm run presentation:build.");
check(existsSync(join(root, "lib", "data", "ncr-cities.json")), "Metro Manila area data", "present", "Run npm run data:boundaries.");

// Ports.
// The web server listens on every address, so a probe on 127.0.0.1 alone can miss it on Windows.
const hostFree = (port, host) => new Promise((resolve) => {
  const probe = net.createServer();
  probe.once("error", () => resolve(false));
  probe.once("listening", () => probe.close(() => resolve(true)));
  probe.listen(port, host);
});
const portFree = async (port) => (await hostFree(port, "127.0.0.1")) && (await hostFree(port, "0.0.0.0"));
for (const port of [3000, 8080]) {
  const free = await portFree(port);
  check(free, `Port ${port}`, free ? "free" : "in use (SafeGo may already be running)", "Run npm run stop.");
}

// Internet access to live sources. Failures here are warnings: the offline mode still works.
const sources = [
  ["Open-Meteo weather", "https://api.open-meteo.com/v1/forecast?latitude=14.6&longitude=121&current=temperature_2m"],
  ["PAGASA alerts", "https://publicalert.pagasa.dost.gov.ph/feeds/"],
  ["OpenStreetMap map tiles", "https://tile.openstreetmap.org/12/3418/1901.png"],
  ["OSRM routing (trip search)", "https://router.project-osrm.org/route/v1/driving/121.0,14.6;121.01,14.61?overview=false"],
];
const online = await Promise.all(sources.map(async ([label, target]) => {
  try {
    const response = await fetch(target, { signal: AbortSignal.timeout(8_000), headers: { "User-Agent": "SafeGo-doctor/1.0" } });
    return [label, response.ok, `HTTP ${response.status}`];
  } catch (error) {
    return [label, false, error instanceof Error ? error.message : "unreachable"];
  }
}));

console.log("\nSafeGo presentation check\n");
for (const { ok, label, detail, fix } of results) {
  console.log(`  ${ok ? "OK  " : "FIX "} ${label.padEnd(24)} ${detail}${ok ? "" : `\n        -> ${fix}`}`);
}
console.log("\n  Internet (live data)");
for (const [label, ok, detail] of online) console.log(`  ${ok ? "OK  " : "WARN"} ${label.padEnd(24)} ${detail}`);

const problems = results.filter((result) => !result.ok);
const offline = online.filter(([, ok]) => !ok);
console.log(problems.length
  ? `\n${problems.length} item(s) need fixing before the presentation (see -> above).`
  : "\nReady. Start with npm run presentation (or double-click Start SafeGo.cmd).");
if (offline.length) {
  console.log("Some live sources are unreachable. If the venue internet is unreliable, use npm run presentation:offline.");
}
console.log("");
process.exitCode = problems.length ? 1 : 0;
