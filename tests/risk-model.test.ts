import assert from "node:assert/strict";
import test from "node:test";
import { analyzeRisk } from "../lib/safego/risk-model.ts";
import type { FactorName, RiskFactor } from "../lib/safego/types.ts";

const names: FactorName[] = [
  "Weather",
  "Flood / roads",
  "Official advisories",
  "School status",
  "Community reports",
];

function factors(scores: [number, number, number, number, number]): RiskFactor[] {
  return names.map((name, index) => ({
    name,
    score: scores[index],
    pill: "low",
    pillText: "Test",
    description: "Test input",
    icon: "weather",
    tone: "icon-weather",
  }));
}

test("calculates the weighted España example", () => {
  const result = analyzeRisk(factors([58, 52, 70, 20, 40]), "", "");
  assert.equal(result.rawScore, 54);
  assert.equal(result.percentage, 54);
  assert.equal(result.key, "mod");
});

test("classifies uniformly low inputs as low risk", () => {
  const result = analyzeRisk(factors([20, 20, 20, 20, 20]), "", "");
  assert.equal(result.percentage, 20);
  assert.equal(result.key, "low");
});

test("applies a high-risk floor for severe road flooding", () => {
  const result = analyzeRisk(factors([10, 70, 10, 0, 0]), "", "");
  assert.equal(result.rawScore, 33);
  assert.equal(result.percentage, 60);
  assert.equal(result.key, "high");
  assert.match(result.safetyRule, /flood \/ road score is 70/i);
});

test("applies a critical floor for extreme road flooding", () => {
  const result = analyzeRisk(factors([10, 90, 10, 0, 0]), "", "");
  assert.equal(result.percentage, 80);
  assert.equal(result.key, "crit");
});

test("applies the corroborated severe-weather floor", () => {
  const result = analyzeRisk(factors([85, 10, 70, 0, 0]), "", "");
  assert.equal(result.percentage, 60);
  assert.equal(result.key, "high");
});
