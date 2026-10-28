# SafeGo demo checklist

Use this before a presentation or supervised test. It checks that the demo is
working; it does not validate real-world safety accuracy.

## Quick start (the day of the presentation)

1. Double-click **`Start SafeGo.cmd`** in the project folder, or run
   `npm run presentation`.
2. Wait for **`SafeGo is ready: http://localhost:3000`**. The browser opens by itself.
3. Keep that window open. Press **Ctrl+C** in it (or close it) to stop SafeGo.

SafeGo is reachable **only from this computer**, not from other devices on the venue
Wi-Fi. To open it on a phone on the same network, start it with
`npm run presentation -- --lan` instead. Community reports and the admin page are
**hidden** in presentation mode whatever `.env.local` says; add `--with-reports` to
show them.

If it says a port is in use, double-click **`Stop SafeGo.cmd`** (or run
`npm run stop`), then start again. `npm run stop` only stops SafeGo's own Node
and Java processes on ports 3000 and 8080; anything else is reported and left
alone.

`npm run presentation` runs the **production** build (faster, no developer
overlay). It rebuilds automatically when the code changed since the last build.

## The day before

1. Install Node.js 24 and JDK 21, then run `npm install` in the project folder.
2. Run `npm run check:all` while online: lint, types, tests, production build,
   Java tests and risk validation must all pass.
3. Run `npm run presentation:build` so the first start on the day is quick.
4. Run `npm run doctor`. Every line should be `OK`; `FIX` lines say what to do.
   `WARN` lines mean a live source is unreachable on this network.
5. Start SafeGo once (step 1 above) and walk through the suggested flow below.
6. Start the replay once too (**`Start SafeGo (replay).cmd`**) so you know it works on this laptop.
7. Check the layout at a desktop width and a narrow phone width.

## Immediately before presenting

1. Run `npm run doctor` on the venue network.
2. Start SafeGo (quick start above) and check the sidebar says **Live weather**.
   Ratings use live Open-Meteo weather and PAGASA alerts only; SafeGo shows no
   demo or placeholder values.
3. Plan the trips you will show once, so you know routing works on this network.
4. Keep official government and school sources open in separate tabs.

## Offline fallback

If the venue internet fails, stop SafeGo and double-click **`Start SafeGo (replay).cmd`**
(or run `npm run presentation:replay`). SafeGo then shows recorded weather from a
documented flood day (17 Aug 2026, 12:00 PM, when 201.7 mm fell in five hours) and
works without internet:

- A **Replay** banner stays at the top, and every "live" label reads "recorded".
- The map, ratings, area details and the four-day time slider all work.
- PAGASA alerts are left out, because there is no record of past alerts. Say so.
- Map tiles, place search and trip routing still need internet; without it the map
  background is blank but the shaded areas and scores still show.

Build another replay pack from any documented day with
`npm run replay:build -- --at YYYY-MM-DDTHH:00 --label "What happened" --source https://dated-report`
(this needs internet once). The newest pack in `data/replay/` is used.

## Suggested five-minute flow

1. Point out the sidebar data status: ratings come from live weather and PAGASA alerts.
2. On the map, click an area: its rating, live weather, rain in the last
   3 and 24 hours, and PAGASA alerts. SafeGo shows only what it can confirm.
3. Switch layers: Weather covers every area live; Announcements shows PAGASA
   alerts for every area.
4. Drag the **time slider** at the bottom back a few days (or press play) to
   show how weather, alerts and risk changed. Use **Back to live** to return.
5. Plan a trip between two places in Metro Manila. Sections are colored by
   risk; any part outside SafeGo's live data is a plain blue line.
6. Open "Why this result" to show the factor breakdown.
7. End with SafeGo's reminder that it does not replace official announcements.

## If something fails

- **Port in use:** `Stop SafeGo.cmd` / `npm run stop`, then start again.
- **Java error:** install JDK 21 and set `JAVA_HOME` (or `SAFEGO_JAVA_HOME`).
  `npm run doctor` shows which JDK is found.
- **Weather unavailable:** the sidebar says so and the map shows no ratings.
  If the internet is down, switch to the replay (see Offline fallback).
- **Map tiles missing:** a connection problem; area shading and scores still work.
- **Trip search fails:** routing needs internet; try nearby landmarks, or skip trips in the replay.
- **Anything else:** stop, run `npm run doctor`, and restart.
