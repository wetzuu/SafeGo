import assert from "node:assert/strict";
import test from "node:test";
import { MockSafeGoRepository } from "../lib/data/mock-repository.ts";

test("mock repository exposes every preset location", async () => {
  const repository = new MockSafeGoRepository();
  const locations = await repository.listLocations();

  assert.equal(locations.length, 7);
  assert.ok(locations.every((location) => location.coordinates.length === 2));
  assert.ok(locations.every((location) => location.risk.percentage >= 0));
});

test("mock repository returns calculated risk details", async () => {
  const repository = new MockSafeGoRepository();
  const result = await repository.getLocationRisk("espana");

  assert.ok(result);
  assert.equal(result.location.id, "espana");
  assert.equal(result.factors.length, 5);
  assert.equal(result.assessment.modelVersion, "1.0.0");
  assert.equal(result.assessment.percentage, 54);
});

test("mock repository returns null for an unknown location", async () => {
  const repository = new MockSafeGoRepository();
  assert.equal(await repository.getLocationRisk("not-a-location"), null);
});
