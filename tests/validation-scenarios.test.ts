import assert from "node:assert/strict";
import test from "node:test";
import { replayScenario, VALIDATION_SCENARIOS } from "../lib/trips/validation-scenarios.ts";

for (const scenario of VALIDATION_SCENARIOS) {
  test(`curated scenario: ${scenario.title}`, () => {
    const trip = replayScenario(scenario);
    assert.equal(trip.riskKey, scenario.expectedBand, scenario.purpose);
    assert.equal(trip.overallRiskScore, scenario.expectedScore);
    if (scenario.id === "hazard-and-gap") {
      assert.ok(trip.segments.some((segment) => segment.riskKey === "crit"));
      assert.ok(trip.segments.some((segment) => segment.riskKey === "unknown"));
    }
  });
}
