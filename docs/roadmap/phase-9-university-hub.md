# Phase 9: University Hub

**Goal:** schools and students get class-suspension information as it happens, and verified school
admins can see conditions around their campus and publish official advisories.
**Source:** the "University Hub" spec (three pillars), received 2026-11-11.

## Decisions (2026-11-11)

- **Order:** pillar 1 (weather-triggered scanner) plus the SSE stream first; the admin dashboard next.
- **Commuter metrics:** opt-in and aggregate only. Count only students who chose to share a planned
  trip to the campus; show counts and average route risk, never individual locations or names.
  No live GPS tracking (out of scope; RA 10173).
- **Who is a school admin:** a server-side allowlist maps each university id to approved admin
  emails. Only those accounts get `SCHOOL_ADMIN` for that campus, and only their advisories show as
  official. Depends on Phase 8 (durable accounts and sessions).

## Pillar 1 + SSE: done 2026-11-11

- `RegionalWeatherMonitor`: CLEAR / LIGHT_RAIN / SEVERE across campus zones; a rise fires
  `WEATHER_ESCALATED` and an immediate scan; 30-minute debounce.
- Registry: every campus has `lguCode` and `impactRadiusMeters` (5 km).
- Scanner: at most 5 sources fetched at once; changed campuses become `UNIVERSITY_ADVISORY` events.
- `SafeGoEventBus` + `GET /api/events` (SSE, university filter, Last-Event-ID replay, heartbeat).
- `WeatherWatch` polls every 5 minutes only while someone listens.
- Web app: `lib/safego/live-events.ts`; refreshes and shows a short notice on each event.

Deviations from the spec, on purpose:

- **No OVERCAST state.** Open-Meteo's overcast code scores like partly cloudy in SafeGo, and overcast
  is the norm in the wet season, so it would scan almost daily. Light rain (score 25+) is the first
  escalated state.
- **"heavy rainfall warning" is not a suspension keyword.** It is a PAGASA weather term; PAGASA
  alerts already count as escalation.
- **The scanner never emits NORMAL**, and scope is `UNSPECIFIED` unless the notice says "all levels".
- **No LGU feeds yet.** LGUs announce on Facebook, which has no public feed a server may read; the
  `lguCode` links campuses to city-wide notices found in government and news feeds.
- Backend is Java, so the spec's `config/universities.ts` / `services/` / `workers/` live in
  `UniversityAnnouncementService`, `RegionalWeatherMonitor` and `events/`.

## Pillar 2: School Admin command center (not started)

1. `SCHOOL_ADMIN` role from the allowlist (`SAFEGO_SCHOOL_ADMINS`, e.g. `ust-manila=a@ust.edu.ph`).
2. Admin page: campus zone map with weather, PAGASA alerts and (once moderated) reports in the radius.
3. Commuter summary from opt-in shared trips: count, average route risk, most common hazard.
4. Advisory control panel: scanner suggestions, publish/revoke `Suspend all classes`, `Shift to
   asynchronous`, `Staff only`, `Resume normal operations`, with a reason. Publishes on the event bus
   with `origin: "school-admin"`, `verified: true`.

## Pillar 3: propagation (partly done)

- Done: SSE to all clients with university filter.
- To do: per-student subscription to their school; persist advisories (database) so they survive a
  restart; decide with the team how an official suspension should affect route ratings (the spec's
  text was cut off at this point).

## Follow-ups

- The spec attachment ended mid-way through pillar 3; ask for the remainder before building it.

## Log

- 2026-11-11: Pillar 1 + SSE built. Java 103/103 tests (compiled with Spring stand-ins), frontend
  106/106, production build; SSE verified streaming through the Next.js `/api` proxy and in a browser.
