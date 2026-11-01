# Phase 3: Frontend structure

**Goal:** the two largest components are split so later phases can change them safely.
**Depends on:** Phase 0. **Size:** medium. No behaviour change.

## The problem

`components/safego/RiskMap.tsx` (~1,150 lines) and `SafeGoApp.tsx` (~730 lines) hold map layers,
tile handling, timeline state, trip state and layout together. Earlier commits fixed re-render lag
here, so performance must not regress.

## Tasks

1. Before touching anything, record a baseline: a screenshot of each main screen at desktop and
   phone width (Playwright is available), and React Profiler render counts for map pan, layer
   switch and timeline scrub.
2. `RiskMap.tsx`: extract the Leaflet setup and tile layer, each overlay layer (area shading,
   route sections, markers), the legend, and tile-status handling into separate modules under
   `components/safego/map/`.
3. `SafeGoApp.tsx`: move trip state, timeline state and dashboard fetching into hooks
   (`useTrip`, `useTimeline`, `useDashboard`) under `components/safego/hooks/`.
4. Keep public props and the rendered output identical.
5. Compare against the baseline screenshots and render counts.

## Definition of done

- No file in `components/safego/` over ~400 lines.
- Screenshots match; render counts are not worse.
- `npm run check` passes.

## Follow-ups

## Log
