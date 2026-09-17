import assert from "node:assert/strict";
import test from "node:test";
import { parseTripInput } from "../lib/trips/trip-input.ts";

test("rejects non-object trip bodies without throwing", () => {
  for (const body of [null, undefined, [], "trip", 42, true]) {
    const result = parseTripInput(body);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "INVALID_TRIP");
  }
});

test("validates endpoints before calling trip services", () => {
  for (const body of [{}, { origin: " ", destination: "Pasig" }, { origin: 42, destination: "Pasig" }, { origin: "a".repeat(161), destination: "Pasig" }]) {
    assert.equal(parseTripInput(body).ok, false);
  }
  const same = parseTripInput({ origin: " Pasig ", destination: "PASIG" });
  assert.equal(same.ok, false);
  if (!same.ok) assert.equal(same.code, "SAME_LOCATION");
});

test("normalizes endpoints and requires an explicit demo flag", () => {
  assert.deepEqual(parseTripInput({ origin: " España ", destination: " Lerma ", preferSavedDemo: "true" }), {
    ok: true, data: { origin: "España", destination: "Lerma", preferSavedDemo: false },
  });
  const demo = parseTripInput({ origin: "España", destination: "Lerma", preferSavedDemo: true });
  assert.equal(demo.ok && demo.data.preferSavedDemo, true);
});
