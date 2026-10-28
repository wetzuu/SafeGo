import assert from "node:assert/strict";
import { test } from "node:test";
import { CSV_HEADER, parseSessions, summarize, susScore } from "../lib/usability/sus.ts";

test("SUS scores follow the standard formula", () => {
  assert.equal(susScore([5, 1, 5, 1, 5, 1, 5, 1, 5, 1]), 100);
  assert.equal(susScore([1, 5, 1, 5, 1, 5, 1, 5, 1, 5]), 0);
  assert.equal(susScore([3, 3, 3, 3, 3, 3, 3, 3, 3, 3]), 50);
  assert.equal(susScore([4, 2, 4, 2, 4, 2, 4, 2, 4, 2]), 75);
  assert.throws(() => susScore([3, 3, 3]));
  assert.throws(() => susScore([6, 3, 3, 3, 3, 3, 3, 3, 3, 3]));
});

test("sessions are read from the CSV, including quoted notes", () => {
  const csv = [
    "# comment lines are ignored",
    CSV_HEADER,
    'P01,2026-11-05,phone,replay,yes,yes,help,yes,no,4,2,4,2,4,2,4,2,4,2,"Thought ""Low"" meant no flooding, at first"',
    "P02,2026-11-05,laptop,live,yes,yes,yes,yes,yes,5,1,5,1,5,1,5,1,5,1,",
  ].join("\n");
  const sessions = parseSessions(csv);
  assert.equal(sessions.length, 2);
  assert.equal(sessions[0].notes, 'Thought "Low" meant no flooding, at first');

  const result = summarize(sessions);
  assert.equal(result.mean, 87.5);
  assert.deepEqual(result.tasks[2], { name: result.tasks[2].name, unaided: 1, withHelp: 1, failed: 0 });
  assert.deepEqual(result.tasks[4], { name: result.tasks[4].name, unaided: 1, withHelp: 0, failed: 1 });
});

test("an empty sessions file reports nothing rather than inventing results", () => {
  const result = summarize(parseSessions(`${CSV_HEADER}\n`));
  assert.equal(result.participants, 0);
  assert.equal(result.mean, null);
});

test("bad rows say which line to fix", () => {
  assert.throws(() => parseSessions(`${CSV_HEADER}\nP01,2026-11-05,phone,live,maybe,yes,yes,yes,yes,3,3,3,3,3,3,3,3,3,3,`), /Line 2/);
});
