# SafeGo roadmap

The working plan for SafeGo after the feature build (Aug–Oct 2026). Each phase has its own file
with scope, tasks, files involved and a definition of done, so any phase can be started on request
("start Phase 3") without re-deriving context.

## Where the project is (2026-11-01)

The features are done and the engineering is solid. What remains is making the product honest about
what it measures and proving the ratings against reality.

- **Done:** Next.js + Java API, live Open-Meteo weather and PAGASA alerts, OSRM routing with
  coverage gating, timeline, replay mode, accounts and bookmarks, weather backtest (8/8 flood days
  High+, 0/7 dry days High+), usability kit, CI (web, Java, containers).
- **Gap 1, product:** the documented five-factor model (`RiskModel`) only runs when operational
  feeds are configured, and they are off by default. Live ratings come from
  `AreaWeatherService` → `RainfallScoring` (weather + PAGASA). The docs and the code describe two
  different systems.
- **Gap 2, duplication:** weights, bands and pilot limits are defined in both TypeScript and Java.
- **Gap 3, coverage:** 18 pilot points × 850 m circles with a 90% gate leave most real trips unrated.
- **Gap 4, validation:** no usability sessions, no expert review, dry days still reach Moderate.
- **Gap 5, production:** public OSRM/Nominatim/tiles, in-memory route cache, sessions and rate limiter.

## Phases

| # | Phase | Depends on | Who | Status |
| --- | --- | --- | --- | --- |
| 0 | [Baseline and doc sync](phase-0-baseline.md) | none | Claude | Partly done (Java tests to run on Windows) |
| 1 | [Product definition](phase-1-product-definition.md) | 0 | Decided: option A | Partly done (Spring tests to run on Windows) |
| 2 | [One source of truth for the model](phase-2-single-source.md) | 1 | Claude | Partly done (Spring context tests via CI) |
| 3 | [Frontend structure](phase-3-frontend-structure.md) | 0 | Claude | Not started |
| 4 | [Route coverage](phase-4-route-coverage.md) | 2 | **Team decision**, then Claude | Not started |
| 5 | [Scoring calibration](phase-5-calibration.md) | 2 | Claude | Not started |
| 6 | [Resilience and offline mode](phase-6-resilience.md) | 0 | Claude | Not started |
| 7 | [Validation with people](phase-7-human-validation.md) | none (can start now) | **Team runs sessions**, Claude prepares and scores | Not started |
| 8 | [Accounts and production hardening](phase-8-production.md) | 1 | **Team decision**, then Claude | Not started |
| 9 | [University Hub](phase-9-university-hub.md) | 8 for school accounts | Decided; Claude | Pillar 1 + SSE done; dashboard not started |

Suggested order: 0 → 1 → 2 → (3, 4, 5 in any order) → 6 → 8. Phase 7 runs in parallel from now,
and must be repeated after any change to rating wording (Phases 1, 4, 5).

**Added outside the phases:** route comparison (2026-11-11, owner request). Up to four routes per
trip, labelled by `classifyRoutes()` with honest wording and relative, caveated drive times. See
README "Route comparison". Repeat Phase 7 task 5 for the badges: nobody should read "LOWEST RISK" as
"safe".

Not now: new features (more university feeds, more account features, new layers). The risk is in
whether the ratings are right, not in missing features.

## How to start a phase

When asked to start Phase N:

1. Read this file and the phase file. Check its dependencies are **Done** in the table; if not,
   say so and ask whether to proceed anyway.
2. If the phase has a **Decision** section that is still open, ask it first (one question, with the
   recommended option) and record the answer in the phase file before writing code.
3. Create a branch `phase-N-<slug>` from `main`. Do not commit or push unless asked.
4. Run `npm run check:all` to record the baseline. If it already fails, report that before changing anything.
5. Work through the tasks in order. Keep changes inside the phase's scope; note anything else
   found under **Follow-ups** in the phase file instead of fixing it.
6. Finish by meeting the phase's **Definition of done**, then set its status here to **Done**
   (or **Partly done**, with what is left) and add a dated line to the phase file's **Log**.

Status values: Not started · In progress · Partly done · Done · Blocked (say on what).

## Project rules every phase keeps

- Live-only data: never add seeded, sample or invented values to the running app. Synthetic data
  lives in `tests/fixtures/` only. Missing data stays missing and is shown as unavailable.
- SafeGo is informational. It never declares suspensions or claims a road is safe.
- Community reports stay disabled until moderation exists.
- Do not tune the scoring and assess it on the same events.
- Next.js here is a newer version than most training data: read `node_modules/next/dist/docs/`
  before changing Next.js code (see `AGENTS.md`).
