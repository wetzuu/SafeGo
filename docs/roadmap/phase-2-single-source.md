# Phase 2: One source of truth for the model

**Goal:** weights, bands, floors and pilot limits are defined once.
**Depends on:** Phase 1 (so the model being centralised is the right one). **Size:** medium.

## The problem

- Weights and bands: `lib/safego/risk-model.ts` (`RISK_WEIGHTS`) and
  `server/demo/.../data/RiskModel.java` (`WEIGHTS`, `BANDS`, floors).
- Pilot limits: `lib/trips/pilot.ts` (ids, `radiusMeters`, `minimumCoveragePercent`,
  `sampleLengthMeters`) and `TripAnalysisService.java` (`PILOT_RADIUS_METERS`,
  `PILOT_MIN_COVERAGE_PCT`), plus the Java location anchors.
- `risk-model.ts` is imported by `AreaDetails`, `RiskGauge`, `RiskMap`, `SafeGoApp`,
  `area-analysis`, `flood-road-estimate`, `honest-risk`, `location-catalog`, `timeline` and
  `validation-scenarios`, so the frontend may be computing ratings itself.

## Approach

Java owns the model. First establish which frontend imports compute ratings and which only
display or label them.

1. Inventory every frontend use of `risk-model.ts` and the pilot constants: compute vs display.
2. Create one shared config, e.g. `config/risk-policy.json` (weights, bands, floors, pilot ids,
   radius, coverage gate, sample length, policy/model version). Java loads it at startup; the
   frontend imports it for display only.
3. Remove client-side rating computation where the API already returns the result; keep it only for
   the synthetic `/validation` workbench if needed, reading the same config.
4. Add a parity test on each side that fails if code and config disagree (e.g. Java test loads the
   JSON and checks `RiskModel`; Node test checks `pilot.ts` re-exports the JSON).
5. Expose the active policy at `GET /api/health` or `meta.policy` so the UI can show the version.

## Definition of done

- Changing a weight, band or radius is a one-file change and both test suites see it.
- `npm run check:all` passes; `npm run validate:risk` and `npm run backtest` give the same results as before.

## Follow-ups

## Log
