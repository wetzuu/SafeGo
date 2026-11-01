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

## Log
