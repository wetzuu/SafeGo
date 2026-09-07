import assert from "node:assert/strict";
import test from "node:test";
import {
  parseFloodRoadFeed,
  parseOfficialAdvisoryFeed,
} from "../lib/providers/operational-feeds.ts";
import {
  applyFloodRoadObservations,
  applyOfficialAdvisories,
} from "../lib/data/operational-overlay.ts";
import { LOCATIONS } from "../lib/safego/locations.ts";

test("normalizes an approved official advisory payload", () => {
  const items = parseOfficialAdvisoryFeed({ items: [{
    id: "pagasa-123",
    locationIds: ["espana"],
    sourceName: "PAGASA",
    sourceKind: "weather",
    title: "Heavy rainfall advisory",
    description: "Heavy rainfall may affect Metro Manila.",
    severityScore: 70,
    issuedAt: "2026-09-07T08:00:00+08:00",
    expiresAt: "2026-09-07T14:00:00+08:00",
    sourceUrl: "https://www.pagasa.dost.gov.ph/advisory/123",
  }] });

  assert.equal(items[0].severityScore, 70);
  assert.deepEqual(items[0].locationIds, ["espana"]);
  assert.equal(items[0].issuedAt, "2026-09-07T00:00:00.000Z");
});

test("rejects unofficial advisory source kinds", () => {
  assert.throws(() => parseOfficialAdvisoryFeed({ items: [{
    id: "social-123",
    locationIds: ["espana"],
    sourceName: "Unknown poster",
    sourceKind: "community",
    title: "Claimed advisory",
    description: "This must not enter the official advisory factor.",
    severityScore: 90,
    issuedAt: "2026-09-07T08:00:00+08:00",
    expiresAt: "2026-09-07T14:00:00+08:00",
    sourceUrl: "https://example.com/post/123",
  }] }), /sourceKind/);
});

test("validates flood and road severity boundaries", () => {
  assert.throws(() => parseFloodRoadFeed({ items: [{
    id: "road-123",
    locationIds: ["espana"],
    sourceName: "Official road office",
    kind: "road",
    title: "Road closure",
    description: "The road is temporarily closed.",
    severityScore: 101,
    observedAt: "2026-09-07T08:00:00+08:00",
    expiresAt: "2026-09-07T09:00:00+08:00",
    sourceUrl: "https://official.example/road/123",
  }] }), /severityScore/);
});

test("rejects non-HTTPS source evidence links", () => {
  assert.throws(() => parseFloodRoadFeed({ items: [{
    id: "flood-123",
    locationIds: ["espana"],
    sourceName: "Official disaster office",
    kind: "flood",
    title: "Road flooding",
    description: "Water is rising at the monitored point.",
    severityScore: 80,
    observedAt: "2026-09-07T08:00:00+08:00",
    expiresAt: "2026-09-07T09:00:00+08:00",
    sourceUrl: "http://unsafe.example/flood/123",
  }] }), /HTTPS/);
});

test("official feed replaces only the advisory factor and keeps provenance", () => {
  const location = LOCATIONS.find((item) => item.id === "espana")!;
  const [advisory] = parseOfficialAdvisoryFeed({ items: [{
    id: "pagasa-456",
    locationIds: ["espana"],
    sourceName: "PAGASA",
    sourceKind: "weather",
    title: "Heavy rainfall advisory",
    description: "Heavy rainfall may affect Metro Manila.",
    severityScore: 80,
    issuedAt: "2026-09-07T08:00:00+08:00",
    expiresAt: "2026-09-07T14:00:00+08:00",
    sourceUrl: "https://www.pagasa.dost.gov.ph/advisory/456",
  }] });
  const updated = applyOfficialAdvisories(location, [advisory]);

  assert.equal(updated.factors.find((factor) => factor.name === "Official advisories")?.score, 80);
  assert.equal(updated.factors.find((factor) => factor.name === "Flood / roads")?.score, 52);
  assert.equal(updated.advisories[0].sourceUrl, advisory.sourceUrl);
});

test("severe flood observations trigger the existing critical safety floor", () => {
  const location = LOCATIONS.find((item) => item.id === "mapua-makati")!;
  const [observation] = parseFloodRoadFeed({ items: [{
    id: "flood-456",
    locationIds: ["mapua-makati"],
    sourceName: "Official disaster office",
    kind: "flood",
    title: "Deep flooding",
    description: "The monitored access road is not passable.",
    severityScore: 90,
    observedAt: "2026-09-07T08:00:00+08:00",
    expiresAt: "2026-09-07T09:00:00+08:00",
    sourceUrl: "https://official.example/flood/456",
  }] });
  const updated = applyFloodRoadObservations(location, [observation]);

  assert.equal(updated.factors.find((factor) => factor.name === "Flood / roads")?.score, 90);
  assert.equal(updated.risk.percentage, 80);
  assert.equal(updated.risk.key, "crit");
});
