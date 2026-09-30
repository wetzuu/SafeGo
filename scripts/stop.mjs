// Stops a SafeGo run left over from an earlier terminal: whatever Node or Java process is listening on
// the web (3000) or API (8080) port. Other programs on those ports are reported, never stopped.
import { spawnSync } from "node:child_process";

const PORTS = [3000, 8080];
const SAFEGO_PROGRAMS = /^(node|java|javaw)(\.exe)?$/i;
const windows = process.platform === "win32";

function listeners(port) {
  if (windows) {
    const result = spawnSync("netstat", ["-ano", "-p", "tcp"], { encoding: "utf8", windowsHide: true });
    const pids = new Set();
    for (const line of (result.stdout ?? "").split(/\r?\n/)) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 5 && parts[3] === "LISTENING" && parts[1].endsWith(`:${port}`)) pids.add(Number(parts[4]));
    }
    return [...pids].filter((pid) => pid > 0);
  }
  const result = spawnSync("lsof", ["-t", `-iTCP:${port}`, "-sTCP:LISTEN"], { encoding: "utf8" });
  return (result.stdout ?? "").split(/\s+/).filter(Boolean).map(Number);
}

function programName(pid) {
  if (windows) {
    const result = spawnSync("tasklist", ["/FI", `PID eq ${pid}`, "/FO", "CSV", "/NH"], { encoding: "utf8", windowsHide: true });
    const first = (result.stdout ?? "").trim();
    // tasklist prints "INFO: No tasks are running…" when the process no longer exists.
    if (!first || first.startsWith("INFO:")) return "";
    return first.split(",")[0]?.replaceAll('"', "").trim() ?? "";
  }
  return (spawnSync("ps", ["-p", String(pid), "-o", "comm="], { encoding: "utf8" }).stdout ?? "").trim().split("/").pop() ?? "";
}

function stopProcess(pid) {
  const result = windows
    ? spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { encoding: "utf8", windowsHide: true })
    : spawnSync("kill", ["-TERM", String(pid)], { encoding: "utf8" });
  // Stopping the web server also stops its Java child, so a process that is already gone counts as stopped.
  return result.status === 0 || !programName(pid);
}

let blocked = false;
let stopped = 0;
for (const port of PORTS) {
  const pids = listeners(port).filter((pid) => programName(pid));
  if (!pids.length) {
    console.log(`Port ${port}: free.`);
    continue;
  }
  for (const pid of pids) {
    // Stopping the web server takes its Java child down too, so it may already be gone here.
    const name = programName(pid);
    if (!name) {
      console.log(`Port ${port}: stopped (it closed with the web server).`);
      stopped += 1;
      continue;
    }
    if (!SAFEGO_PROGRAMS.test(name)) {
      console.log(`Port ${port}: used by ${name} (PID ${pid}). Not a SafeGo process, so it was left running.`);
      blocked = true;
      continue;
    }
    if (stopProcess(pid)) {
      console.log(`Port ${port}: stopped ${name} (PID ${pid}).`);
      stopped += 1;
    } else {
      console.log(`Port ${port}: could not stop ${name} (PID ${pid}). Close its terminal or stop it in Task Manager.`);
      blocked = true;
    }
  }
}

console.log(blocked
  ? "\nSome ports are still in use by other programs. Close them, then start SafeGo again."
  : stopped ? "\nSafeGo is stopped. Ports 3000 and 8080 are free." : "\nNothing to stop. Ports 3000 and 8080 are free.");
process.exitCode = blocked ? 1 : 0;
