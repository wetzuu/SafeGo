import assert from "node:assert/strict";
import test from "node:test";
import { relativeTime, routeBadge, routeStory, schoolTicket, skyReport, toneForScore, weatherLevel, type SkyReportInput } from "../lib/safego/humanize-risk.ts";
import type { TradeoffTag } from "../lib/trips/route-comparison.ts";

const TAGS: TradeoffTag[] = ["BEST BALANCE", "LOWEST RISK · SLOWER", "LOWEST RISK", "QUICKEST · HIGHER RISK", "QUICKEST", "BALANCED", "ALTERNATIVE", "ONLY ROUTE FOUND", "HIGH RISK · AVOID", "NOT ENOUGH DATA"];
const NEVER = /\bsafe(st)?\b|\bdry\b|puddle|ankle|knee|waist|depth|flooded street/i;

test("weather is shown as intensity steps, never as a flood depth", () => {
  assert.deepEqual([0, 24, 25, 44, 45, 69, 70, 100].map((score) => weatherLevel(score).step), [0, 0, 1, 1, 2, 2, 3, 3]);
  assert.equal(weatherLevel(null).step, null);
  for (const score of [0, 30, 60, 90]) assert.doesNotMatch(`${weatherLevel(score).label} ${weatherLevel(score).advice}`, NEVER);
});

test("tones follow the risk bands", () => {
  assert.deepEqual([10, 40, 65, 90, null].map(toneForScore), ["calm", "rain", "danger", "danger", "unknown"]);
});

test("route badges and stories are friendly and never promise a safe or dry way", () => {
  for (const tag of TAGS) {
    const badge = routeBadge(tag, 40);
    const story = routeStory({ tag, deltaSeconds: 300, routeCount: 3, score: 40 });
    assert.ok(badge.label.length > 0 && badge.icon.length > 0, tag);
    assert.doesNotMatch(`${badge.label} ${story}`, NEVER, tag);
    assert.doesNotMatch(`${badge.label} ${story}`, /points|risk score|tradeoff|delta/i, `no jargon: ${tag}`);
  }
  assert.equal(routeBadge("HIGH RISK · AVOID", 80).tone, "danger");
  assert.equal(routeBadge("LOWEST RISK · SLOWER", 45).tone, "rain", "a Moderate route is never green");
  assert.equal(routeStory({ tag: "LOWEST RISK · SLOWER", deltaSeconds: 300, routeCount: 3, score: 10 }), "The calmest of the 3 ways, but 5 min longer.");
});

const base: SkyReportInput = { weatherScore: 10, worstPlace: "España Blvd., Sampaloc", pagasaAlert: false, scan: { state: "standby", at: null }, suspensions: [], replay: false };

test("the sky report walks from clear to rain to checking schools to no classes", () => {
  assert.equal(skyReport(base).step, 0);
  const rain = skyReport({ ...base, weatherScore: 40 });
  assert.equal(rain.step, 1);
  assert.match(rain.headline, /Light rain or gusts near España Blvd\./);
  const checking = skyReport({ ...base, weatherScore: 40, scan: { state: "scanning", at: null } });
  assert.equal(checking.step, 2);
  assert.ok(checking.busy);
  const checked = skyReport({ ...base, weatherScore: 40, scan: { state: "scanned", at: "2026-11-11T09:55:00Z" } }, Date.parse("2026-11-11T10:00:00Z"));
  assert.match(checked.line, /Schools checked 5 min ago\. No suspension found yet\./);
  const off = skyReport({ ...base, weatherScore: 40, suspensions: [{ name: "University of Santo Tomas", status: "suspended", verified: false }] });
  assert.equal(off.step, 3);
  assert.match(off.line, /Reported by the news/);
});

test("a PAGASA alert alone counts as rain, and missing weather is said plainly", () => {
  assert.equal(skyReport({ ...base, pagasaAlert: true }).step, 1);
  assert.match(skyReport({ ...base, pagasaAlert: true }).headline, /PAGASA has an alert/);
  assert.equal(skyReport({ ...base, weatherScore: null }).step, null);
  assert.equal(skyReport({ ...base, replay: true }).headline, "Skies were clear");
});

test("school tickets say who posted and whether it is official", () => {
  const ticket = schoolTicket({ name: "University of Santo Tomas (España, Manila)", status: "suspended", verified: false, sourceName: "GMA News" });
  assert.equal(ticket.title, "No classes on campus at University of Santo Tomas");
  assert.equal(ticket.trust, "reported");
  assert.equal(schoolTicket({ name: "FEU", status: "online", verified: true, sourceName: null }).trust, "official");
});

test("relative times", () => {
  const now = Date.parse("2026-11-11T10:00:00Z");
  assert.equal(relativeTime("2026-11-11T10:00:20Z", now), "just now");
  assert.equal(relativeTime("2026-11-11T09:57:00Z", now), "3 min ago");
  assert.equal(relativeTime("2026-11-11T07:00:00Z", now), "3 h ago");
  assert.equal(relativeTime("nope", now), "");
});
