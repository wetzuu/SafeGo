# Phase 4: Route coverage

**Goal:** common Metro Manila trips get a rating instead of "insufficient coverage".
**Depends on:** Phase 2 (pilot limits must live in one place). **Size:** medium to large.

## The problem

Coverage counts route length within 850 m of one of 18 pilot points; below 90% there is no overall
rating (calm-area exception aside). A recorded check gave España–Mapúa Makati 29.9%.

## Decision (open, ask before starting)

- **A. More points along corridors (recommended first).** Add anchors along EDSA, España–Quezon
  Ave, Taft, C-5, Commonwealth, Ortigas Ave, Roxas Blvd. Cheap: each anchor is name + coordinates,
  weather is fetched per anchor. Watch the Open-Meteo call count and the dashboard cache.
- **B. Score along the road.** Sample weather on a grid (or at fixed distances along the route)
  instead of circles around named places. Better coverage, bigger change to the coverage model and
  the "basis" explanation.

## Tasks

1. Build a fixed benchmark of 15–20 real trips (campus to campus, common commutes) in
   `tests/fixtures/coverage-trips.json`, with the coverage each gets today. Script it so it can be rerun.
2. Implement the chosen option through the shared policy from Phase 2.
3. Rerun the benchmark; record before/after coverage per trip in `docs/PILOT_VALIDATION.md`.
4. Rerun `npm run backtest` (the place list changes) and note any change in results.
5. Update the validation scenarios and tests that assume the old pilot.

## Definition of done

- At least 80% of benchmark trips reach the coverage gate (target, adjust with the team).
- Unknown sections are still drawn and never scored as zero.
- `npm run check:all` passes; backtest rerun and documented.

## Follow-ups

## Log
