# SafeGo pilot and validation plan

## Implemented pilot

The initial pilot is the union of provisional 850-meter circles around España,
Lerma, Quiapo and Mapúa Makati. It is not all of Manila or Makati and does not
cover the roads between those areas automatically. The canonical IDs are in
`lib/trips/pilot.ts`. Binondo, Katipunan and Ortigas remain repository fixtures
but are excluded from pilot search, map coverage and route scoring because their
inputs were cloned from España.

The 850-meter radius reuses the former map illustration. The 90% route-coverage
gate is a provisional product choice, not an independently validated threshold.
Changes require reviewing the scenario results and updating the shared policy.

## Coverage calculation and API changes

- Preserve all routing geometry vertices and split edges longer than 100 meters.
- Select the nearest pilot point at each short edge midpoint. Only cover an edge
  when the distance from its start to that point plus the entire edge length is
  within 850 meters. This conservative bound can leave small boundary gaps and
  can vary slightly by direction; it avoids claiming coverage beyond a circle.
- Weight coverage by geometric length, not the number of vertices. Internal
  lengths are not travel-distance or arrival-time estimates.
- Below 90% coverage, return `overallRiskScore: null`, `rawRiskScore: null`,
  `riskKey: "unknown"`, and `riskName: "INSUFFICIENT COVERAGE"` with HTTP 200.
- Unknown segments have null scores and null basis IDs. Gray dashed route lines
  represent unknown information. They never contribute zero to an average.
- At or above 90%, average only covered lengths. Keep the existing High/Critical
  floors. An uncovered remainder remains visible and may contain severe hazards.
- Include coverage percentage, covered/unknown lengths, longest unknown gap,
  radius, threshold, policy ID and the source statuses captured for that trip.
- Aggregate corridor notices only from points that actually support covered
  segments. Empty corridor lists are valid; do not substitute distant points.

Existing clients must handle nullable scores. Geographic coverage is independent
of evidence quality: seed data in PostgreSQL is still demonstration data, and
active modeled weather does not verify a flood observation. The result explains
this distinction and shows its own snapshot time. Dashboard refresh does not
recalculate an existing trip.

## Run the curated acceptance cases

Run `npm run validate:risk` for the scenario table and `npm test` for regression
checks. With `npm run dev`, open `/validation` to inspect the same scenarios in
the actual overview and map components. This page returns 404 in production.
Scores and geometry are synthetic, deterministic and explicitly labeled. Map
tiles require internet; replaying the calculations does not call providers.

The cases cover calm conditions, severe road flooding, critical flooding,
corroborated severe weather, a long coverage gap, a critical covered section with
an unknown remainder, and an entirely outside-pilot route. Expected outcomes are
reviewable product acceptance expectations, not observed historical outcomes.

## Historical and expert validation — pending

No historical event has been reconstructed or independently reviewed yet.
Do not describe passing synthetic tests as proof that the risk model predicts
safe travel. Before expanding the pilot, ask a local flood/transport reviewer to
assess the radius, 90% gate, input weights, school-status contribution and floors.

For each historical case, record the event date/time and timezone, exact road
geometry, authoritative source URL or archived document, observation location,
issued/observed/expiry times, known passability or closure outcome, permitted
reuse, normalization rationale and uncertainties. Do not infer flood depth from
general rainfall alone. Missing evidence must stay missing.

Record an expected band or “insufficient information” before replaying the
model, with reviewer name/role and rationale. Compare actual versus expected,
record false reassurance separately from conservative overestimation, and keep
unresolved disagreements visible. Include dry controls and closure cases.
Do not tune and assess the model on exactly the same cases; reserve reviewed
cases for a later check after any weight changes.

| Case | Evidence and observation time | Expected result and rationale | Actual result | Reviewer | Decision |
| --- | --- | --- | --- | --- | --- |
| Pending | No evidence collected | Pending | Not run | Unassigned | Not validated |

## Usability sessions — ready to run, not yet conducted

Recruit 5–10 target commuters/students for 15–20 minute sessions, including phone
users. Ask permission to take anonymous notes; use participant codes and omit
home addresses. Explain that this is a prototype with simulated conditions.
Avoid explaining the score or legend before they attempt the tasks.

1. On `/`, identify the supported areas and analyze the España-to-Lerma example.
   Ask what the result means and where they would look next. Provider-dependent
   routing may fail; log that separately from a comprehension failure.
2. On `/validation`, choose “Calm covered route.” Ask whether they would treat
   the score as permission to travel and what other evidence they would check.
3. Choose “Calm points with a long uncovered gap.” Ask why there is no overall
   score, then have them find the gaps on the map and explain gray dashed lines.
4. Choose “Known critical section and an unknown remainder.” Ask whether the
   missing overall score means no hazards exist. Have them locate the known
   critical section and explain the unknown remainder.
5. In a real trip result, expand “Why this result?” Ask which sources are
   connected versus stored, whether modeled weather is an official warning,
   and how they would obtain a new trip snapshot.
6. Choose the outside-pilot scenario. Ask what action they would take next.

Record completion without prompting, task time, wrong interpretation, help
needed, device and an optional verbatim quote. Do not invent session outcomes.
Suggested iteration gate: at least 4 of the first 5 participants distinguish
unknown from low risk, identify the coverage limitation, and find the source
explanation without coaching. Any belief that gray means safe or that a low
score guarantees safety requires a design revision and another check. This is
a small formative study, not statistical proof of effectiveness.

| Participant code | Device | Task | Completed unprompted | Interpretation/quote | Issue | Follow-up |
| --- | --- | --- | --- | --- | --- | --- |
| Pending | — | — | Not run | — | — | Recruit participants |

## Implementation verification — 2026-09-11

- All 39 automated tests passed, including seven synthetic acceptance cases,
  the coverage threshold, unknown states, geometry preservation and risk floors.
- Lint, TypeScript and the production build passed. The built `/validation`
  response has HTTP status 404.
- Browser smoke checks exercised the normal planner and scenario workbench.
  With provider access, España–Lerma returned 100% coverage and a rating;
  España–Mapúa Makati returned 29.9% coverage and no overall rating. These are
  run-specific geometry results, not validation of actual road safety.
- Checked narrow-layout navigation, source disclosure, unknown-map legend,
  gray route rendering, known critical sections and the zero-coverage empty state.
  These are developer checks, not sessions with target users.
