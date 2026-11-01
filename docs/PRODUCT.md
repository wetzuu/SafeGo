# What SafeGo measures

SafeGo is a **weather-and-alerts travel risk rater for Metro Manila, with road routing**. It tells
you how severe the weather and official alerts are where you are going and along the roads in
between. It does not check whether a street is flooded, passable or closed.

## What a live rating is made of

With the default configuration (no approved flood/road or advisory feed connected), every live
rating comes from two sources:

| Input | Source | How it becomes a 0–100 score |
| --- | --- | --- |
| Weather | Open-Meteo forecast models | The highest of: sky condition, current rain rate, wind gusts, last hour's rain, rain over the last 3 hours (more than 65 mm in 3 hours is PAGASA's red threshold), and forecast rain over the next 3 hours (`RainfallScoring`) |
| Official alerts | PAGASA public alerts (CAP) whose polygons cover the place | Extreme 90, Severe 70, Moderate 45, other 25; 0 when no alert covers it (`PagasaCapService`) |

**The rating is the higher of the two.** Scores of 0–29 are Low, 30–59 Moderate, 60–79 High and
80–100 Critical. In the app and the API this is a `partial` rating: `risk.basis` is `"partial"` and
`risk.countedFactors` lists `Weather` and `Official advisories`.

The same rule is used everywhere a rating appears:

- **Places (the 18 pilot points):** `LiveRating` in the Java API, mirrored by `lib/safego/honest-risk.ts`.
- **Map areas:** the higher of live weather at the area's sample point, any PAGASA alert covering it,
  and the nearest pilot point's rating (`lib/safego/area-analysis.ts`).
- **Trips:** route sections within 850 m of a pilot point take that point's rating; other sections in
  Metro Manila take the higher of nearby live weather and PAGASA alerts. Below 90% pilot coverage the
  trip has no overall rating (see `docs/PILOT_VALIDATION.md`).

The "Flood / roads" map layer is an **estimate from rainfall** (`lib/safego/flood-road-estimate.ts`),
labelled as such. It is not an observation of flooding.

## What SafeGo does not measure

- Whether a street is flooded, passable or closed. No flood sensor, MMDA or LGU feed is connected.
- Traffic, travel time or arrival estimates.
- Community reports (intake is disabled until moderation exists).
- Class suspensions. SafeGo shows university notices it finds, but never declares a suspension.

So **Low means the weather and alerts look calm, not that the roads were checked.** The app says this
wherever a Low rating appears.

## The five-factor model (when feeds are connected)

`RiskModel` combines five factors with weights set in `config/risk-policy.json`: flood and road conditions 40%, weather 25%,
official advisories 20%, community reports 10%, nearby university status 5%, plus safety floors
(flood/road 70+ cannot rate below High, 85+ cannot rate below Critical, severe weather 85+ with an
official advisory 70+ cannot rate below High).

It produces the rating (`risk.basis: "full"`) **only when every factor has a live source**: an
approved flood/road feed, PAGASA or an approved advisory feed, Open-Meteo, and database mode for
community and university data. Until then it is not used for live ratings, because averaging in
factors that have no source would make a storm look calm (severe weather 90 with a Moderate PAGASA
alert would average to about 32, Moderate, instead of Critical).

Feed contracts and the approval checklist are in `docs/SOURCE_FEEDS.md`.

## Rating basis values

| `risk.basis` | Meaning | Score |
| --- | --- | --- |
| `full` | Every factor has a live source | Weighted five-factor model with safety floors |
| `partial` | Some factors are live (the default: weather and PAGASA alerts) | Highest live factor; no safety floors |
| `none` | No live source for this place right now | Not rated (shown as "No live data"; never as safe) |

## Validation status

The weather scoring is backtested against documented flood and dry days (`docs/BACKTEST.md`).
Usability sessions and an independent expert review have not been done yet
(`docs/PILOT_VALIDATION.md`, `docs/roadmap/phase-7-human-validation.md`).
