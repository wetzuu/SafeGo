import assert from "node:assert/strict";
import test from "node:test";
import { parseCommunityReportInput } from "../lib/reports/report-input.ts";

test("accepts and normalizes a valid community report", () => {
  const result = parseCommunityReportInput({
    locationId: "mapua-makati",
    reportType: "Flooding",
    locationText: "  Mapúa   Makati gate  ",
    description: "  Water is rising near the main gate.  ",
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.locationText, "Mapúa Makati gate");
    assert.equal(result.data.description, "Water is rising near the main gate.");
  }
});

test("rejects invalid report types", () => {
  const result = parseCommunityReportInput({
    locationId: "mapua-makati",
    reportType: "Definitely Safe",
    locationText: "Mapúa Makati gate",
    description: "Everything looks fine from here.",
  });
  assert.deepEqual(result, { ok: false, message: "Choose a valid report type." });
});

test("rejects descriptions that cannot help other travelers", () => {
  const result = parseCommunityReportInput({
    locationId: "mapua-makati",
    reportType: "Other",
    locationText: "Mapúa Makati gate",
    description: "bad",
  });
  assert.deepEqual(result, {
    ok: false,
    message: "Describe what you observed in 10 to 500 characters.",
  });
});
