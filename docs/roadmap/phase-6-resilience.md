# Phase 6: Resilience and offline mode

**Goal:** SafeGo keeps working when public services or the internet fail, and stops depending on
free public endpoints.
**Depends on:** Phase 0. **Size:** large; tasks are independent and can be done one at a time.

## The problem

- Routing: public OSRM demo server (`SAFEGO_ROUTING_BASE_URL`). Geocoding: public Nominatim.
  Tiles: `tile.openstreetmap.org` in `RiskMap.tsx`.
- Successful routes are cached in memory for ten minutes (`RoutingService`), lost on restart.
- Replay mode replaces weather only; tiles, search and routing still need internet.

## Tasks

1. **Self-hosted routing:** add an OSRM service to `compose.staging.yaml` (and an optional local
   compose profile) built from a Geofabrik Philippines extract; document build time and RAM.
2. **Persistent route and geocode cache:** keep the TTL but back it with disk or PostgreSQL so a
   restart does not empty it.
3. **Configurable tiles:** tile URL from config; allow a local tile folder for the NCR bounding box
   (zoom 11–16), with OSM attribution kept.
4. **Fully offline replay:** replay packs can include recorded geocode and route responses for
   listed trips (`scripts/replay-build.ts`). In replay mode these are served and labelled
   "recorded", consistent with the Replay banner. Live mode still never draws a saved route.
5. **Test with the network off:** a Playwright test that runs replay with outbound requests blocked.

## Definition of done

- With the network off, replay shows tiles, search for listed places and listed trips.
- Live mode can point at self-hosted routing by config alone.
- `npm run check:all` passes; `docs/ARCHITECTURE.md` and `docs/STAGING.md` updated.

## Follow-ups

## Log
