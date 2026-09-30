# SafeGo demo checklist

Use this before a presentation or supervised test. It checks that the demo is
working; it does not validate real-world safety accuracy.

## Quick start (the day of the presentation)

1. Double-click **`Start SafeGo.cmd`** in the project folder, or run
   `npm run presentation`.
2. Wait for **`SafeGo is ready: http://localhost:3000`**. The browser opens by itself.
3. Keep that window open. Press **Ctrl+C** in it (or close it) to stop SafeGo.

If it says a port is in use, double-click **`Stop SafeGo.cmd`** (or run
`npm run stop`), then start again. `npm run stop` only stops SafeGo's own Node
and Java processes on ports 3000 and 8080; anything else is reported and left
alone.

`npm run presentation` runs the **production** build (faster, no developer
overlay). It rebuilds automatically when the code changed since the last build.

## The day before

1. Install Node.js 24 and JDK 21, then run `npm install` in the project folder.
2. Run `npm run check:demo` while online: lint, types, tests, production build,
   Java tests and risk validation must all pass.
3. Run `npm run presentation:build` so the first start on the day is quick.
4. Run `npm run doctor`. Every line should be `OK`; `FIX` lines say what to do.
   `WARN` lines mean a live source is unreachable on this network.
5. Start SafeGo once (step 1 above) and walk through the suggested flow below.
6. Check the layout at a desktop width and a narrow phone width.

## Immediately before presenting

1. Run `npm run doctor` on the venue network.
2. Start SafeGo (quick start above) and note whether the sidebar says
   **Live weather**. Live data comes from Open-Meteo and PAGASA; flood/road,
   community and university values are demo data and are shown as
   "Demo · not counted".
3. Use the saved example trips first: España–Lerma, España–Quiapo and
   Quiapo–Lerma (either direction). These work without internet routing.
4. Keep official government and school sources open in separate tabs.

## Offline fallback

If the venue internet is unreliable, run
`npm run presentation:offline`. Live weather and PAGASA alerts are turned off,
every rating shows as **not rated** (SafeGo never presents demo data as live),
and the saved example trips still work. Map tiles and arbitrary place searches
need internet. Build beforehand (`npm run presentation:build`) so no downloads
are needed.

## Suggested five-minute flow

1. Point out the sidebar data status: what is live and what is demo.
2. On the map, click a barangay: its analysis, live weather, rain in the last
   3 and 24 hours, and PAGASA alerts. Explain "partial" and "Demo · not counted".
3. Switch layers: Weather covers every area live; Announcements shows PAGASA
   alerts for every area.
4. Drag the **time slider** at the bottom back a few days (or press play) to
   show how weather, alerts and risk changed. Use **Back to live** to return.
5. Load the example trip, or plan a trip between two places in Metro Manila.
   Point out solid sections (near SafeGo locations), lighter dashed sections
   (area estimates) and gray sections (not enough data).
6. Open "Why this result" to show the factor breakdown.
7. End with SafeGo's reminder that it does not replace official announcements.

## If something fails

- **Port in use:** `Stop SafeGo.cmd` / `npm run stop`, then start again.
- **Java error:** install JDK 21 and set `JAVA_HOME` (or `SAFEGO_JAVA_HOME`).
  `npm run doctor` shows which JDK is found.
- **Weather unavailable:** the sidebar says so; do not call stored values live.
  Switch to `npm run presentation:offline` if the internet is down.
- **Map tiles missing:** a connection problem; area shading and scores still work.
- **Trip search fails:** use a saved example trip rather than inventing a route.
- **Anything else:** stop, run `npm run doctor`, and restart.
