# Phase 5: Scoring calibration

**Goal:** fewer false Moderate ratings on dry days without losing flood days, measured honestly.
**Depends on:** Phase 2. **Size:** medium.

## The problem

Backtest: 8/8 flood days High+, 0/7 dry days High+, but 7/7 dry days still reach Moderate, mostly
from afternoon wind gusts (`WeatherService.gustScore`) or a brief shower. Model rain runs well
below PAGASA gauge readings, so sky condition carries most flood warnings.

## Tasks

1. Expand `data/backtest/events.json` to at least 20 flood days and 20 dry days, each with a dated,
   linked source. Include ordinary rainy-but-passable days as a third class if sources allow.
2. Split events into a **tuning set** and a **held-out set** before changing anything; record the
   split in the file. Never tune on the held-out set.
3. Adjust gust and sky-condition thresholds in `RainfallScoring` / `WeatherService` against the
   tuning set only. Keep the 65 mm/3 h red threshold (PAGASA's).
4. Report both sets in `docs/BACKTEST.md`: flood days High+, dry days High+, dry days Moderate+,
   with the before/after thresholds.
5. Bump the model/policy version.

## Definition of done

- Held-out results reported next to tuning results, no cherry-picking.
- Flood-day detection on the held-out set does not drop.
- Java tests updated; `npm run check:all` passes.

## Follow-ups

## Log
