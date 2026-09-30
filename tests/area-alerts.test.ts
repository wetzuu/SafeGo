import assert from "node:assert/strict";
import test from "node:test";
import { alertsCovering, type ActiveAlert } from "../lib/safego/area-alerts.ts";

const alert = (id: string, severityScore: number, polygon: Array<[number, number]>): ActiveAlert => ({
  id,
  event: "General Flood Advisory",
  headline: id,
  description: "",
  severity: "Moderate",
  severityScore,
  urgency: "Expected",
  certainty: "Likely",
  issuedAt: null,
  expiresAt: "2099-01-01T00:00:00Z",
  sourceUrl: "https://publicalert.pagasa.dost.gov.ph/",
  areas: [{ description: "Area", polygons: [polygon] }],
});

// [latitude, longitude] squares.
const metroManila: Array<[number, number]> = [[14.5, 120.95], [14.5, 121.1], [14.7, 121.1], [14.7, 120.95], [14.5, 120.95]];
const northOnly: Array<[number, number]> = [[14.65, 120.95], [14.65, 121.1], [14.7, 121.1], [14.7, 120.95], [14.65, 120.95]];

test("an area takes the highest severity among alerts covering it", () => {
  const result = alertsCovering([14.68, 121.0], [alert("ncr", 45, metroManila), alert("north", 70, northOnly)]);
  assert.equal(result.score, 70);
  assert.deepEqual(result.alerts.map((item) => item.id), ["ncr", "north"]);
});

test("alerts that do not cover the area are ignored", () => {
  const result = alertsCovering([14.55, 121.0], [alert("north", 70, northOnly)]);
  assert.equal(result.score, 0);
  assert.equal(result.alerts.length, 0);
});

test("polygon points are read as latitude, longitude", () => {
  assert.equal(alertsCovering([121.0, 14.6], [alert("ncr", 45, metroManila)]).score, 0);
  assert.equal(alertsCovering([14.6, 121.0], [alert("ncr", 45, metroManila)]).score, 45);
});
