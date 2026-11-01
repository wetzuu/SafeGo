# Phase 7: Validation with people

**Goal:** evidence that people read the ratings correctly, and an outside check of the model's limits.
**Depends on:** none; repeat after Phases 1, 4 and 5 change wording or ratings.
**Who:** the team runs the sessions and contacts the reviewer. Claude prepares material,
scores results and turns findings into tasks. Claude never fills in sessions that did not happen.

## Tasks

1. **Usability sessions:** follow `docs/USABILITY_SESSIONS.md` (5–8 participants, replay mode,
   five tasks, SUS). Record each in `data/usability/sessions.csv`; run `npm run sus`.
2. **Gate:** at least 4 of the first 5 get task 5 right unaided ("Low does not mean not flooded").
   If not, change the rating wording and test with two more people.
3. **Findings to tasks:** every misread or `help`/`no` outcome becomes a Follow-up here or in the
   relevant phase.
4. **Expert review:** one local flood or transport reviewer assesses the 850 m radius, the 90%
   gate, the thresholds and the floors. Use the case table in `docs/PILOT_VALIDATION.md`; record
   name/role, rationale and disagreements as written.

## What Claude can do when this phase is started

- Print-ready session sheet and SUS form; a short brief for the expert reviewer.
- Validate the CSV, run `npm run sus`, summarise results, propose wording changes.

## Definition of done

- `docs/USABILITY_RESULTS.md` generated from real sessions and the task-5 gate met.
- At least one expert review row filled in `docs/PILOT_VALIDATION.md`.

## Follow-ups

## Log
