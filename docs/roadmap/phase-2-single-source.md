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

- **Route scoring is still implemented twice:** `lib/trips/route-risk.ts` (the browser re-scores
  trips, including sections estimated from live weather along the route) and
  `TripAnalysisService.java`. Their constants now come from the policy and the shared validation
  scenarios cover both, but the algorithm is duplicated. Moving it server-only needs the route
  weather estimate (`lib/trips/route-estimate.ts`) in Java first.
- `honestLocation` (TypeScript) remains for data the server never rated: the local catalog shown
  before the first API response and the timeline's past hours.
- The university-scan trigger still reads the pre-`LiveRating` score (carried over from Phase 1).

## Log

- 2026-11-01: Worked directly on `main` at the owner's request (no phase branch).
- 2026-11-01: Inventory. Weights/bands/floors were in `RiskModel.java` and `risk-model.ts`; band
  cut-offs (29/59/79) were also hand-written in `WeatherService`, `OperationalFeedService`,
  `TripAnalysisService` (twice), `route-risk.ts`, `plain-language.ts` and
  `flood-road-estimate.ts`; pilot id/name/18 ids/radius/90% gate/sample length were in both
  `TripAnalysisService.java` and `pilot.ts`; calm-area limits in both route implementations.
- 2026-11-01: New `config/risk-policy.json` holds all of them. Java reads it through
  `data/RiskPolicy.java` (classpath `/risk-policy.json`; Gradle adds `../../config` as a resource
  folder; `Dockerfile.api` keeps the repo layout so the path resolves). The web app reads it through
  `lib/safego/risk-policy.ts`; `Dockerfile.web` and `Dockerfile.tools` copy `config/`. Every band
  lookup and route floor now derives from the policy's bands. `RiskPolicy.validate()` fails startup
  if weights do not sum to 1 or bands do not ascend to 100.
- 2026-11-01: The browser no longer re-scores locations the API already rated (`risk.basis` set).
  `/api/health` reports `modelVersion` and `pilotId`.
- 2026-11-01: Checks. Frontend: lint, typecheck, 93/93 tests (new `risk-policy.test.ts`),
  `validate:risk`, production build. Java, compiled against Gradle's bundled Jackson 2.16 with
  small stand-ins for Spring annotations: 89/89 tests pass, including the new `RiskPolicyTest`,
  `RouteRiskTest`, `TripAssessmentTest`, `ValidationScenariosTest`, `DashboardServiceTest`,
  `OperationalFeedsTest` and `LiveRatingTest`. Not run here: Spring-context tests
  (`DemoApplicationTests`, `LocationsControllersTest`, `ReportsControllerTest`,
  `TripAnalyzeControllerTest`), the Gradle resource wiring and the Docker builds. CI on `main`
  covers them.
