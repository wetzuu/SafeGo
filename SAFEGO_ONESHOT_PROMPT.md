You're picking up development on SafeGo, a risk-aware route-safety app for Philippine roads (flood/weather hazard overlay on routing). Work was previously done in a different AI tool (GPT/Codex); that session ended and you're continuing from its last state. Read the full context below, verify it against the actual repo (don't assume anything is still true until you've checked), then continue the work.

## Stack
Next.js + TypeScript, PostgreSQL. Live integrations already in place: weather, routing, geocoding. A normalized adapter layer already exists for future official data feeds — see `docs/SOURCE_FEEDS.md`.

## The problem this work is solving
SafeGo could rate *any* Philippine route by snapping it to the nearest of only 4 stored risk points, even when that point was kilometers away — producing a confident-looking rating for places it actually knew nothing about. The work below fixes that "coverage validity" problem before any new features or data sources get added.

## Decisions already made — treat as settled unless the repo shows otherwise
1. Pilot boundary = the 4 original preset locations (repo has 7 presets total: 4 original + 3 copied demo entries — the 3 demo copies are excluded from the pilot).
2. Monitoring radius = existing 850m circles around each pilot point — provisional, not yet validated against real conditions.
3. A route needs ≥90% geographic coverage by monitored points to get an overall safety rating.
4. Uncovered segments render neutrally (gray/unscored), never green, and are excluded from the overall rating.
5. Coverage is checked per-section along the actual road path (preserving bends), not straight-line distance.
6. Result UI handles an "insufficient coverage / no overall rating" state while still surfacing hazards found in covered sections.
7. Adjacent short gray sections are visually joined (road geometry preserved underneath) — separate tiny gray segments were unreadable at low zoom.
8. Validation uses a curated set of 7 explicitly-labeled *simulated* scenarios (calm, severe flood, hazard-then-gap, route outside pilot) — inspectable via a local scenario-review page added to the app, not just test output.
9. Next real data integration priority: verified flood/road-passability feed first (carries ~40% of the current model's weight), official advisories second. Live weather is already connected — not a near-term priority.
10. Explicitly deferred: community submissions/accounts, GPS, live traffic, further UI expansion. Community reporting specifically is deferred because it creates moderation/privacy/abuse/verification burden before it adds trustworthy risk data.

## What's already done (verify, don't redo)
- Pilot boundary + 90% coverage threshold implemented; uncovered sections render gray and are excluded from ratings.
- Route calculation preserves road geometry and checks coverage per-section.
- Result screens updated for the unrated state.
- `validation-scenarios.ts`, `validate-risk.ts`, `validation-scenarios.test.ts` added; `route-risk.test.ts` extended; a local scenario-review page added.
- Map rendering fix for adjacent gray sections at low zoom.
- Last known full check: lint clean, TypeScript clean, 39 tests passing, production build succeeds.
- Live end-to-end test on a real route (España → Lerma) succeeded at 100% pilot coverage, correctly showing modeled weather plus stored advisory/flood signals.

## What was interrupted / unverified
A real-route test specifically for the coverage-gap case (a route that only partially overlaps the pilot boundary) was in progress when the previous session dropped. **Do this first**, before anything else, and don't assume it already passes.

## Your task, in order
1. Run the full check (lint, TypeScript, tests, build) and confirm current state matches "last known status" above. Flag any drift.
2. Finish the interrupted real-route coverage-gap test. Confirm partial-coverage routes correctly withhold an overall rating while still showing hazards in the covered portion.
3. Do not start on new data-source integrations, community features, accounts, GPS, or traffic yet — those are deferred/blocked pending human input (see below).
4. Once step 2 passes, report back with: current test count, anything that broke or drifted from the decisions above, and confirmation the coverage-gap case behaves correctly. Stop there for review before moving to PostgreSQL staging deployment or provider selection.

## Cannot be resolved by you — needs a human
- Historical/curated storm-scenario validation reviewed by someone with local flood/transport knowledge (the 7 simulated scenarios are a placeholder, not a substitute).
- 5–10 real user usability walkthroughs.
- Selection/approval of the one authoritative flood/road-passability provider to integrate next.
Don't attempt to fill these in yourself — surface them as open blockers when you report back.
