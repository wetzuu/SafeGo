// Takes the manual's screenshots from a running SafeGo and prints manual.html to PDF, using Edge or
// Chrome in headless mode (no extra packages needed).
//
//   node docs/user-manual/capture.mjs shots http://localhost:3001   retake the screenshots
//   node docs/user-manual/capture.mjs pdf                           rebuild SafeGo-User-Manual.pdf
//
// "shots" signs up throwaway accounts and posts sample reports, so point it at a test copy of SafeGo
// whose SAFEGO_ADMIN_EMAILS includes admin@safego.test, not at one people are using.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const [mode = "pdf", base = "http://localhost:3001"] = process.argv.slice(2);
const browserPath = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
].find(existsSync);
if (!browserPath) throw new Error("Edge or Chrome was not found.");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const profile = join(tmpdir(), `safego-manual-${Date.now()}`);
const port = 9333;

let socket;
let nextId = 0;
const pending = new Map();
async function connect() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = targets.find((target) => target.type === "page");
      if (page) {
        socket = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
        socket.onmessage = (event) => {
          const message = JSON.parse(event.data);
          const waiter = pending.get(message.id);
          if (!waiter) return;
          pending.delete(message.id);
          if (message.error) waiter.reject(new Error(message.error.message)); else waiter.resolve(message.result);
        };
        return;
      }
    } catch { /* the browser is still starting */ }
    await sleep(200);
  }
  throw new Error("The headless browser did not start.");
}
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++nextId;
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});

// Helpers available to every script run in the page.
const PAGE_HELPERS = `
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const button = (text, root = document) => [...root.querySelectorAll("button, a")].find((el) => el.getBoundingClientRect().width && (el.getAttribute("aria-label") || el.textContent).trim().startsWith(text));
  const type = (el, value) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, value); el.dispatchEvent(new Event("input", { bubbles: true })); };
  const api = async (path, method = "GET", body) => {
    // A dev-server reload can drop a request, so try a few times.
    for (let attempt = 0; ; attempt += 1) {
      try { return (await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined })).status; }
      catch (error) { if (attempt >= 3) throw error; await wait(1500); }
    }
  };
  const waitFor = async (find, timeout = 40000) => { for (let waited = 0; waited < timeout; waited += 300) { const found = find(); if (found) return found; await wait(300); } throw new Error("Timed out waiting for the page: " + find); };
  const signIn = async (email, name, password) => { const made = await api("/api/auth/register", "POST", { email, name, password }); return made === 200 ? made : await api("/api/auth/login", "POST", { email, password }); };
  if (!document.getElementById("manual-capture-style")) {
    const style = document.createElement("style");
    style.id = "manual-capture-style";
    style.textContent = "nextjs-portal { display: none !important; }";
    document.head.append(style);
  }
`;
async function run(script) {
  const result = await send("Runtime.evaluate", { expression: `(async () => { ${PAGE_HELPERS}\n${script} })()`, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
}
async function open(url, settle = 9_000) {
  await send("Page.navigate", { url });
  await sleep(settle);
}
async function viewport(width, height, mobile = false) {
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: mobile ? 2.5 : 1.5, mobile });
  await send("Emulation.setTouchEmulationEnabled", { enabled: mobile });
}
async function shot(name) {
  await run("await wait(400);");
  const { data } = await send("Page.captureScreenshot", { format: "png" });
  mkdirSync(join(here, "images"), { recursive: true });
  writeFileSync(join(here, "images", `${name}.png`), Buffer.from(data, "base64"));
  console.log(`saved ${name}.png`);
}

async function takeShots() {
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });
  await viewport(1360, 850);
  await open(base, 12_000);
  // Fixed so a second run can sign back in to the same throwaway accounts on the test server.
  const password = "manual-capture-a1b2";
  console.log("setup", await run(`
    localStorage.setItem("safego-theme", "light");
    localStorage.setItem("safego-hint-seen", "1");
    const out = [];
    out.push(await signIn("juan@safego.test", "Juan Dela Cruz", ${JSON.stringify(password)}));
    if ((await (await fetch("/api/auth/session")).json()).data.bookmarks.length) return "already set up";
    out.push(await api("/api/account/bookmarks", "POST", { name: "Campus", location: "España Blvd., Sampaloc" }));
    out.push(await api("/api/account/bookmarks", "POST", { name: "Office", location: "Ortigas Center, Pasig" }));
    out.push(await api("/api/reports", "POST", { locationId: "espana", reportType: "Flooding", locationText: "España corner Lacson", description: "Ankle-deep water at the corner. Cars are slowing down." }));
    out.push(await api("/api/reports", "POST", { locationId: "espana", reportType: "Road Hazard", locationText: "Morayta St.", description: "Stalled jeepney blocking the right lane." }));
    out.push(await api("/api/reports", "POST", { locationId: "ortigas-pasig", reportType: "Other", locationText: "Ortigas Ave.", description: "Unrelated advertisement posted as a report." }));
    return out.join(" ");
  `));

  // Admin: verify one report so the public screens show both states.
  await run(`await api("/api/auth/logout", "POST"); return await signIn("admin@safego.test", "SafeGo Admin", ${JSON.stringify(password)});`);
  await open(`${base}/admin`, 9_000);
  await run(`const card = await waitFor(() => [...document.querySelectorAll("main li")].find((li) => li.innerText.includes("Ankle-deep")) || button("All"));
    if (card.tagName === "LI") { button("Verify", card).click(); await wait(1200); }
    button("All").click(); await wait(500);`);
  await shot("08-admin");

  // Back to the ordinary account for the public screens.
  await run(`await api("/api/auth/logout", "POST"); return await api("/api/auth/login", "POST", { email: "juan@safego.test", password: ${JSON.stringify(password)} });`);
  await open(base, 15_000);
  await shot("01-main");

  await run(`(await waitFor(() => button("Juan Dela Cruz"))).click(); await wait(700); const panel = document.querySelector(".account-panel"); panel.scrollTop = 0;`);
  await shot("07-account");
  await run(`const panel = document.querySelector(".account-panel"); panel.scrollTop = panel.scrollHeight; await wait(300);`);
  await shot("07-bookmarks");
  await run(`button("Close account panel").click(); await wait(400);`);

  await run(`button("See conditions").click(); await wait(1200); button("Updates").click(); await wait(2500); button("Show a sample announcement")?.click(); await wait(600); document.querySelector(".main-col")?.scrollTo(0, 0);`);
  await shot("05-updates");
  await run(`button("Reports").click(); await wait(1500); document.querySelector(".main-col")?.scrollTo(0, 0);`);
  await shot("06-reports");
  await run(`button("Why this result").click(); await wait(1500); document.querySelector(".main-col")?.scrollTo(0, 0);`);
  await shot("04-why");

  // A trip.
  await open(base, 12_000);
  await run(`
    type(document.querySelectorAll(".trip-planner input")[0], "España Blvd., Sampaloc"); await wait(300);
    document.querySelector(".add-trip-stop").click(); await wait(500);
    type(document.querySelectorAll(".trip-planner input")[1], "Ortigas Center, Pasig"); await wait(1500);
    document.activeElement?.blur(); await wait(300);
    document.querySelector(".trip-planner .submit-btn").click(); await wait(14000);
  `);
  await shot("03-trip");

  // Phone.
  await viewport(390, 800, true);
  await open(base, 14_000);
  await shot("09-phone");
  await run(`document.querySelector("button[aria-expanded]").click(); await wait(800);`);
  await shot("10-phone-search");
}

function printPdf() {
  const output = join(here, "..", "SafeGo-User-Manual.pdf");
  const result = spawnSync(browserPath, [
    "--headless=new", "--disable-gpu", "--no-first-run", `--user-data-dir=${profile}`, "--no-pdf-header-footer",
    `--print-to-pdf=${output}`, pathToFileURL(join(here, "manual.html")).href,
  ], { stdio: "ignore", timeout: 120_000 });
  if (result.error || !existsSync(output)) throw new Error("The PDF could not be printed: " + (result.error?.message ?? "no file was written"));
  console.log(`saved ${output}`);
}

if (mode !== "shots") {
  printPdf();
  rmSync(profile, { recursive: true, force: true, maxRetries: 3 });
  process.exit(0);
}

const browser = spawn(browserPath, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--hide-scrollbars", "--no-first-run", "about:blank"], { stdio: "ignore" });
try {
  await connect();
  await send("Page.enable");
  await send("Runtime.enable");
  await takeShots();
} finally {
  socket?.close();
  browser.kill();
  await sleep(500);
  rmSync(profile, { recursive: true, force: true, maxRetries: 3 });
}
