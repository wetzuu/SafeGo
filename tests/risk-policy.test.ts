import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { bandMinimum, RISK_POLICY } from "../lib/safego/risk-policy.ts";
import { bandLabel, RISK_MODEL_VERSION, RISK_WEIGHTS, riskBand } from "../lib/safego/risk-model.ts";
import { PILOT } from "../lib/trips/pilot.ts";
import { routeRiskBand } from "../lib/trips/route-risk.ts";
import { scoreWord } from "../lib/safego/plain-language.ts";

// The Java API reads the same file (RiskPolicy.java); this checks the web app does too.
const file = JSON.parse(readFileSync(new URL("../config/risk-policy.json", import.meta.url), "utf8"));

test("the web app reads its model values from config/risk-policy.json", () => {
  assert.deepEqual(RISK_POLICY.weights, file.weights);
  assert.deepEqual(RISK_WEIGHTS, file.weights);
  assert.equal(RISK_MODEL_VERSION, file.modelVersion);
  assert.deepEqual(PILOT, file.pilot);
  assert.equal(PILOT.locationIds.length, 18);
});

test("the policy is internally consistent", () => {
  const sum = Object.values(RISK_POLICY.weights).reduce((total, weight) => total + weight, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);
  assert.equal(RISK_POLICY.bands.at(-1)?.maximum, 100);
});

test("every band lookup agrees at the edges", () => {
  for (const [score, key, label] of [[29, "low", "Low"], [30, "mod", "Moderate"], [59, "mod", "Moderate"], [60, "high", "High"], [79, "high", "High"], [80, "crit", "Critical"]] as const) {
    assert.equal(riskBand(score).key, key);
    assert.equal(routeRiskBand(score).key, key);
    assert.equal(bandLabel(score), label);
    assert.equal(scoreWord(score), label);
  }
  assert.deepEqual([bandMinimum("low"), bandMinimum("mod"), bandMinimum("high"), bandMinimum("crit")], [0, 30, 60, 80]);
});
