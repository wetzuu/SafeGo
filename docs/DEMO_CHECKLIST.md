# SafeGo demo checklist

Use this before a presentation or supervised test. It checks that the demo is
working; it does not validate real-world safety accuracy.

## The day before

1. Install Node.js 24 and JDK 21.
2. From the project root, run `npm install`.
3. Run `npm run check:demo` while internet access is available.
4. Run `npm run dev` once so Gradle and Java dependencies are cached.
5. Open `http://localhost:3000` and confirm `/api/health` returns `ready`.
6. Load the built-in example trip and confirm the overview, map, factors,
   announcements, conditions and nearby-university sections open.
7. Confirm the map legend distinguishes Low, Moderate, High, Critical and
   Unknown. Unknown sections must remain gray and dashed.
8. Check the layout at a desktop width and a narrow phone width.

## Immediately before presenting

1. Close older SafeGo terminals so ports 3000 and 8080 are free.
2. Run `npm run dev` and wait for `SafeGo is ready`.
3. Refresh the dashboard and note whether weather is current or stored.
4. Use the built-in España-to-Lerma example first. Do not depend on arbitrary
   searches for the core presentation.
5. Open one confirmed university announcement link before the presentation.
6. Keep official government and school sources available in separate tabs.

## Offline fallback

Run `npm run dev:offline`. This disables live weather and forces mock data while
keeping the saved example route available. The Gradle and npm dependencies must
already have been installed. Arbitrary locations still require public geocoding
and routing, so demonstrate the built-in example.

## Suggested five-minute flow

1. Search or choose a supported area.
2. Explain the current/stored data banner and overall risk summary.
3. Open the map and switch one or two layers.
4. Open nearby-university status and a confirmed post, when available.
5. Add a destination or load the example trip.
6. Point out colored covered sections and gray unknown sections.
7. End with the source explanation and SafeGo's official-announcement warning.

## If something fails

- Port warning: close the old SafeGo process, then restart.
- Java warning: select JDK 21 with `JAVA_HOME` or `SAFEGO_JAVA_HOME`.
- Weather unavailable: continue only after the UI says it is showing stored
  conditions; do not call the snapshot live.
- Map tiles unavailable: explain the connection issue and use the dashboard
  values, but do not imply the blank map proves a route is safe.
- Arbitrary route failure: return to the built-in example rather than inventing
  a route or score.
