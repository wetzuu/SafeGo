# Phase 0: Baseline and doc sync

**Goal:** a clean, verified starting point where the docs match the code.
**Depends on:** none. **Size:** small (an hour or two).

## Tasks

1. Run `npm run check:all` and `npm run doctor`; record the result in the Log.
2. Fix doc drift:
   - README "Flow" says "four pilot risk points"; README route-risk section and
     `docs/PILOT_VALIDATION.md` list five; `lib/trips/pilot.ts` has 18. Make all of them say 18
     (or link to `pilot.ts` instead of listing names).
   - Check every README section against the code it describes (endpoints table, risk model,
     screens, scripts) and correct anything stale.
3. Pin the toolchain: add `engines` to `package.json` and an `.nvmrc`. Confirm `doctor.mjs`
   checks the same versions. (Done as `>=22.18.0`, the real minimum because scripts run `.ts`
   directly; `.nvmrc` is 24, matching CI and Docker.)
4. Add `docs/roadmap/` to the README's documentation links.

## Files

`README.md`, `docs/PILOT_VALIDATION.md`, `docs/DEMO_CHECKLIST.md`, `package.json`, `scripts/doctor.mjs`.

## Definition of done

- `npm run check:all` passes.
- No doc names a different pilot count or a script that does not exist.
- Node version is stated once and enforced.

## Follow-ups

- `docs/SOURCE_FEEDS.md` has CRLF line endings while the rest of the repo is LF; consider a
  `.gitattributes` with `* text=auto eol=lf`.
- `docs/API.md` does not document `/api/alerts/universities`, `/api/areas/weather/history`, the
  bookmark endpoints or `/api/admin/reports` in detail (they are listed in the README table).

## Log

- 2026-11-01: Baseline on branch `phase-0-baseline`, checked on a Linux copy with Node 22.23:
  lint, typecheck, 89/89 tests, `validate:risk` (8/8 scenarios) and production build passed.
  Java tests not run (no JDK 21 available in the check environment).
- 2026-11-01: Doc sync. Pilot count now 18 everywhere (README, PILOT_VALIDATION). Removed docs for
  endpoints deleted from the Java server (`/api/locations`, `/api/locations/:id/risk`,
  `/api/sources/status`) and pointed their references at `/api/dashboard`. Removed references to
  the deleted seed script and `staging:seed`. Fixed stale API examples (`mock` backend,
  `saved-demo` routing, `manila-makati-v1` pilot id). README endpoint table rebuilt from the
  controllers; README links to `docs/API.md` (was `server/API.md`) and the roadmap.
- 2026-11-01: Toolchain. `engines.node >=22.18.0`, `.nvmrc` 24, `doctor.mjs` checks 22.18+.
- 2026-11-01: After changes: lint, typecheck, 89/89 tests, `validate:risk`, build and
  `git diff --check` all pass. **Remaining:** run `npm run check:all` (includes Java tests) and
  `npm run doctor` on the Windows machine, then mark this phase Done.
