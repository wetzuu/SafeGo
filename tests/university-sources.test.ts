import assert from "node:assert/strict";
import test from "node:test";
import { primarySourceFor, REVIEWED_ANNOUNCEMENT_POSTS, sourcesForUniversities } from "../lib/safego/university-sources.ts";
import type { UniversityStatus } from "../lib/safego/types.ts";

function university(id: string): UniversityStatus {
  return { id, name: id, logoPath: "", logoAlt: "", status: "no-update", statusLabel: "", announcement: "", date: "", time: "", isMock: true };
}

test("nearby source lookup returns only channels for the selected universities", () => {
  const sources = sourcesForUniversities([university("ust-manila"), university("plp-pasig")]);
  assert.deepEqual(sources.map((source) => source.id), ["ust-official", "ust-csc", "plp-official", "plp-student-services"]);
});

test("the primary source is always the university administration channel", () => {
  const source = primarySourceFor(university("feu-manila"));
  assert.equal(source?.kind, "university");
  assert.equal(source?.id, "feu-official");
});

test("reviewed examples are retained as evidence, not live source records", () => {
  assert.equal(REVIEWED_ANNOUNCEMENT_POSTS.length, 3);
  assert.ok(REVIEWED_ANNOUNCEMENT_POSTS.every((post) => post.url.startsWith("https://www.facebook.com/")));
});
