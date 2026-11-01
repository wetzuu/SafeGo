# Phase 1: Product definition

**Goal:** the README, the UI and the code describe the same rating system.
**Depends on:** Phase 0. **Size:** small to medium, mostly wording plus a little code.

## The problem

The README presents a five-factor weighted model (flood/roads 40%, weather 25%, advisories 20%,
community 10%, school 5%). In the code, `RiskModel.analyzeRisk` only runs from
`OperationalFeedService` when feeds are configured, and they are disabled by default. What users
see comes from `AreaWeatherService` → `RainfallScoring`: the highest of sky conditions, rain rate,
gusts, last-hour rain and the 65 mm/3 h red threshold, plus PAGASA alerts.

## Decision (open, ask before starting)

- **A. Own what it is (recommended).** SafeGo is a weather-and-alerts travel risk rater with road
  routing. The five-factor model is documented as the target for when approved feeds are connected.
- **B. Make the model real.** Connect at least one real flood/road source through the existing
  normalized feed contract (`docs/SOURCE_FEEDS.md`) so the 40% factor is no longer always empty.
  Much larger; depends on finding a source that permits reuse.

Record the decision here before writing code.

**Decided 2026-11-01: option A (own what it is).** Branch `phase-1-product-definition`, stacked on `phase-0-baseline`.

## Tasks (option A)

1. Write `docs/PRODUCT.md`: what SafeGo measures today, what it does not (road flooding, traffic,
   closures), and the inputs behind a live rating. One page.
2. Update README "Risk model" to describe the live path first (`RainfallScoring` + PAGASA), then the
   five-factor model as the feed-enabled mode.
3. Audit UI copy (`components/safego/labels.ts`, `AreaDetails.tsx`, `TripOverview.tsx`,
   "Why this result"): every rating explanation names its actual inputs. "Low" must read as "weather
   looks calm", never as "safe" or "not flooded".
4. Make the API say which path produced a rating: add a field such as
   `assessment.basis: "weather-alerts" | "weighted-feeds"` in Java and show it in the UI.
5. Tests: one Java test and one frontend test that assert the basis field and the wording.

## Tasks (option B)

Write a separate plan in this file first: candidate source, licence/reuse terms, adapter, failure
behaviour, and how it is validated. Then implement through `OperationalFeedService`.

## Files

`README.md`, `docs/PRODUCT.md` (new), `components/safego/*`, `server/demo/.../data/AreaWeatherService.java`,
`RiskModel.java`, `model/RiskAssessment.java`, tests.

## Definition of done

- A reader of the README can predict what drives a live rating.
- Every rating shown in the UI states its basis.
- Phase 7 task 5 ("does Low mean not flooded?") has wording to test.

## Follow-ups

- **Phase 2:** `LiveRating.java` and `lib/safego/honest-risk.ts` now apply the same rule twice
  (Java, then the browser again). Make Java the only one and have the frontend display `risk.basis`.
- The user manual PDF is built from `docs/user-manual/manual.html` (Low row reworded); regenerate it
  with `docs/user-manual/capture.mjs`.
- `UniversityAnnouncementService` checks `risk().percentage() >= RISK_TRIGGER_SCORE` before
  `LiveRating` runs, so its "high rating" trigger sees the diluted weighted score. Rain and PAGASA
  alerts still trigger scans. Left unchanged here to keep scan behaviour identical; revisit in Phase 2.
- **Phase 7:** the Low wording to test in task 5 is now in `lib/safego/plain-language.ts`.

## Log

- 2026-11-01: Decision A. Found that the browser already rescored ratings from live factors
  (`honest-risk.ts`: highest live factor, basis full/partial/none) but the Java API still returned
  the weighted five-factor score with missing factors counted as 0, e.g. a storm (weather 90,
  Moderate PAGASA alert 45) read as 32 Moderate in `/api/dashboard` and `/api/trips/analyze`
  while the screen showed 90 Critical.
- 2026-11-01: Java. New `data/LiveRating.java` applies the live-factor rule as the last step of
  `DashboardService.snapshot`, so both endpoints now match the screen. `RiskAssessment` gained
  `basis` and `countedFactors` (old 10-argument constructor kept, defaults to `"full"` with all
  factors). `RiskModel` gained `bandKey`/`bandName`. New `LiveRatingTest` (5 tests).
- 2026-11-01: Wording. Low advice no longer says "Travel as usual"; it says SafeGo does not check
  streets for flooding. The partial-rating caveat now ends "not street checks". User manual HTML updated.
- 2026-11-01: Docs. New `docs/PRODUCT.md`; README risk model rewritten (live rule first, five-factor
  model as the feed-enabled mode); `docs/API.md` documents `risk.basis` and `risk.countedFactors`.
- 2026-11-01: Checks. Frontend: lint, typecheck, 90/90 tests (new: Low never reads as safe),
  `validate:risk`, build, `git diff --check` pass. Java: `LiveRatingTest` 5/5 and `RiskModelTest`
  5/5 pass with plain `javac` (Maven Central unreachable here, so Spring tests could not run).
  **Remaining:** `npm run check:all` on Windows, then mark Done.
