import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync, readdirSync } from "node:fs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cwd = join(root, "server", "demo");
for (const file of [".env.local", ".env"]) {
  const path = join(root, file);
  if (existsSync(path)) process.loadEnvFile(path);
}
const windows = process.platform === "win32";
const javaName = windows ? "java.exe" : "java";
const javacName = windows ? "javac.exe" : "javac";
const localJdks = windows && process.env.LOCALAPPDATA
  ? join(process.env.LOCALAPPDATA, "Programs", "SafeGoJdk21")
  : null;
const localHomes = localJdks && existsSync(localJdks)
  ? readdirSync(localJdks, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("jdk-21"))
    .map((entry) => join(localJdks, entry.name))
  : [];
const candidates = [process.env.SAFEGO_JAVA_HOME, process.env.JAVA_HOME, ...localHomes]
  .filter(Boolean);
function isJava21(home) {
  if (!existsSync(join(home, "bin", javacName))) return false;
  const check = spawnSync(join(home, "bin", javaName), ["-version"], {
    encoding: "utf8", windowsHide: true,
  });
  return /(?:openjdk|java) version "21(?:\.|\")/.test(`${check.stdout ?? ""}\n${check.stderr ?? ""}`);
}
const javaHome = candidates.find(isJava21);
if (!javaHome) {
  const pathCheck = spawnSync(javaName, ["-version"], { encoding: "utf8", windowsHide: true });
  const selected = `${pathCheck.stdout ?? ""}\n${pathCheck.stderr ?? ""}`.match(/version "(?:1\.)?(\d+)/)?.[1];
  console.error(`SafeGo's Java API requires JDK 21. ${selected ? `Java ${selected} is currently selected.` : "No usable JDK 21 was found."}`);
  console.error("Install JDK 21 and set JAVA_HOME (or SAFEGO_JAVA_HOME) to its installation folder, then run npm run dev again.");
  process.exit(1);
}
const java = join(javaHome, "bin", javaName);
const childEnv = { ...process.env, JAVA_HOME: javaHome };
console.log(`Starting SafeGo Java API with JDK 21: ${javaHome}`);
const command = windows ? "cmd.exe" : "./gradlew";
const args = windows ? ["/d", "/s", "/c", "gradlew.bat bootJar"] : ["bootJar"];
const build = spawn(command, args, {
  cwd,
  stdio: "inherit",
  env: childEnv,
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
  server = spawn(java, ["-jar", jar], { cwd, stdio: "inherit", env: childEnv });
  server.on("error", (error) => { console.error(`Could not start Java API: ${error.message}`); process.exitCode = 1; });
  server.on("exit", (serverCode) => { process.exitCode = serverCode ?? 1; });
});
