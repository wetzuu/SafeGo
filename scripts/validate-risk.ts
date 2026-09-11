import { replayScenario, VALIDATION_SCENARIOS } from "../lib/trips/validation-scenarios.ts";

console.log("Synthetic acceptance scenarios — not historical or expert validation.");
const results = VALIDATION_SCENARIOS.map((scenario) => {
  const trip = replayScenario(scenario);
  return { scenario: scenario.id, coverage: `${trip.coverage.coveredPercent}%`, expected: scenario.expectedBand, actual: trip.riskKey, score: trip.overallRiskScore, pass: trip.riskKey === scenario.expectedBand && trip.overallRiskScore === scenario.expectedScore };
});
console.table(results);
if (results.some((result) => !result.pass)) process.exitCode = 1;
