import assert from "node:assert/strict";
import test from "node:test";
import type { Polygon } from "geojson";
import { areaContains, distanceMeters, scoreArea, scoreClass } from "../lib/safego/area-scoring.ts";

// A square of roughly 1.1 km around Quiapo, as [longitude, latitude] positions.
const square: Polygon = {
  type: "Polygon",
  coordinates: [[[120.98, 14.59], [120.99, 14.59], [120.99, 14.60], [120.98, 14.60], [120.98, 14.59]]],
};

test("areaContains uses latitude/longitude order for points", () => {
  assert.equal(areaContains(square, [14.595, 120.985]), true);
  assert.equal(areaContains(square, [14.605, 120.985]), false);
});

test("areaContains excludes holes", () => {
  const withHole: Polygon = {
    type: "Polygon",
    coordinates: [square.coordinates[0], [[120.984, 14.594], [120.986, 14.594], [120.986, 14.596], [120.984, 14.596], [120.984, 14.594]]],
  };
  assert.equal(areaContains(withHole, [14.595, 120.985]), false);
  assert.equal(areaContains(withHole, [14.591, 120.981]), true);
});

test("scoreArea takes the highest nearby score, never an average", () => {
  const score = scoreArea(square, [
    { id: "calm", coordinates: [14.595, 120.985], score: 20 },
    { id: "flooded", coordinates: [14.596, 120.986], score: 70 },
  ], 850);
  assert.deepEqual(score, { score: 70, sourceId: "flooded" });
});

test("scoreArea leaves areas without nearby data unrated", () => {
  assert.equal(scoreArea(square, [{ id: "far", coordinates: [14.70, 121.10], score: 10 }], 850), null);
});

test("scoreArea counts points just outside the area but within the radius", () => {
  const justNorth: [number, number] = [14.6015, 120.985];
  assert.ok(distanceMeters([14.595, 120.985], justNorth) < 850);
  assert.equal(scoreArea(square, [{ id: "north", coordinates: justNorth, score: 45 }], 850)?.score, 45);
});

test("scoreClass buckets scores into ten 10-point classes", () => {
  assert.equal(scoreClass(0), 0);
  assert.equal(scoreClass(29), 2);
  assert.equal(scoreClass(60), 6);
  assert.equal(scoreClass(100), 9);
});
