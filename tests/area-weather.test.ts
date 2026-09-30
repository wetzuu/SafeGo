import assert from "node:assert/strict";
import test from "node:test";
import type { AreaCollection } from "../lib/safego/area-scoring.ts";
import { weatherGroupKey, weatherSamplePoints } from "../lib/safego/area-weather.ts";

const square = (lon: number, lat: number) => ({
  type: "Polygon" as const,
  coordinates: [[[lon, lat], [lon + 0.01, lat], [lon + 0.01, lat + 0.01], [lon, lat + 0.01], [lon, lat]]],
});

const collection: AreaCollection = {
  type: "FeatureCollection",
  features: [
    { type: "Feature", properties: { name: "A", city: "Quezon City", level: "barangay", psgc: "1", areaKm2: 1 }, geometry: square(121.0, 14.6) },
    { type: "Feature", properties: { name: "B", city: "Quezon City", level: "barangay", psgc: "2", areaKm2: 1 }, geometry: square(121.02, 14.6) },
    { type: "Feature", properties: { name: "Sampaloc", city: "City of Manila", level: "district", psgc: null, areaKm2: 5 }, geometry: square(120.99, 14.6) },
  ],
};

test("barangays share their city's weather sample; Manila districts get their own", () => {
  const points = weatherSamplePoints(collection);
  assert.deepEqual(points.map((point) => point.key).sort(), ["City of Manila: Sampaloc", "Quezon City"]);
  assert.equal(weatherGroupKey(collection.features[2].properties), "City of Manila: Sampaloc");
});

test("a city's sample point is the average of its areas' centres", () => {
  const quezon = weatherSamplePoints(collection).find((point) => point.key === "Quezon City");
  assert.ok(quezon);
  assert.ok(Math.abs(quezon.coordinates[1] - 121.015) < 0.002);
  assert.ok(Math.abs(quezon.coordinates[0] - 14.604) < 0.002);
});

test("past day labels read Yesterday, then short dates", async () => {
  const { pastDayLabel } = await import("../lib/safego/area-weather.ts");
  assert.equal(pastDayLabel("2026-09-30", 1), "Yesterday");
  assert.equal(pastDayLabel("2026-09-27", 4), "Sun, Sep 27");
});
