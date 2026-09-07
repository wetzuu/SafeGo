# SafeGo

Point-to-point travel risk information during severe weather. Enter an origin and destination, then SafeGo identifies the connecting roads, estimates the risks along them, and displays color-coded route sections on a real interactive map.

The current build combines OSRM road geometry, submit-only OpenStreetMap geocoding, live modeled weather from Open-Meteo, and SafeGo’s stored risk locations. It can ingest approved normalized official-advisory and flood/road feeds when configured; otherwise those signals keep their stored fallbacks. Community submission remains disabled until moderation exists.

SafeGo is informational only. It does not declare class suspensions. Follow official school and government announcements.

## Running

### Prototype

```bash
npx http-server prototype
```

Open `http://localhost:8080` in your browser.

### Next.js App

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

The default `auto` data mode uses the built-in mock dataset when no database is configured, so the commands above remain the quickest way to work on the front end.

The dashboard requests a fresh snapshot when it opens, when the user presses Refresh, and every five minutes while the page remains open. Set `SAFEGO_WEATHER_PROVIDER=disabled` for fully offline development.

### PostgreSQL/PostGIS data mode

Create a PostgreSQL database with PostGIS available, copy `.env.example` to `.env.local`, and update `DATABASE_URL`. Then run:

```bash
npm run db:setup
npm run dev
```

Set `SAFEGO_DATA_MODE=database` to require the database. Use `mock` to force the local fixtures, or `auto` to use the database only when `DATABASE_URL` is present.

The database commands are repeatable: migrations are recorded in `schema_migrations`, and seeding replaces each preset location's observations, advisories, reports, and current assessment without duplicating them.

## Flow

1. Enter a starting point and destination, or load the Buting-to-Mapúa example.
2. SafeGo resolves both places, identifies the connecting road route, and checks its sections against nearby calculated SafeGo risk points.
3. Review the route score, hotspots, colored map, corridor alerts, conditions, and reports.
4. Select **Plan another trip** to start again.

## Screens

| Screen       | Contents                                                          |
| ------------ | ----------------------------------------------------------------- |
| Search       | Location field, result list, suggested areas                      |
| Overview     | Route score, risk coverage, hotspots, advisories, and major roads  |
| Risk factors | SafeGo risk points and factors covering the route                  |
| Alerts       | Notices aggregated from coverage points near the route             |
| Map          | Real road route with green/yellow/orange/red risk sections         |
| Conditions   | Hazards and community observations near the route                  |
| Reports      | Public report form and corridor reports                            |

Sidebar on desktop. Top bar and bottom tabs on smaller screens.

## Application structure

The Next.js app is independent from the original static prototype:

- `components/safego/` contains the React interface and interactive map.
- `lib/safego/locations.ts` is the current mock-data source.
- `lib/safego/risk-model.ts` contains the versioned risk calculation.
- `lib/safego/types.ts` defines the shared domain contracts for future APIs.
- `lib/data/` contains the mock and PostgreSQL repositories used by API routes.
- `db/migrations/` contains the PostgreSQL/PostGIS schema.
- `scripts/db-migrate.ts` and `scripts/db-seed.ts` set up local or hosted databases.
- `prototype/` remains available as the original design reference only.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the runtime data flow, trust boundaries, future Java migration boundary, and pre-push checklist.

## Data APIs

| Endpoint | Purpose |
| --- | --- |
| `GET /api/locations` | Lists map/search locations with coordinates and current risk |
| `GET /api/locations/:id/risk` | Returns the assessment, factors, advisories, and reports for one location |
| `GET /api/sources/status` | Shows whether feeds are mock, active, degraded, or disabled |
| `GET /api/dashboard` | Combines stored SafeGo signals with current modeled weather for the UI |
| `POST /api/trips/analyze` | Resolves A and B, identifies connecting roads, and calculates route risk |
| `POST /api/reports` | Disabled unless both community intake and moderation are explicitly enabled |

Responses include `meta.backend` (`mock` or `database`) and `meta.generatedAt`. They are intentionally not cached so a refresh requests current provider data. The UI starts with local fixtures for an instant render and replaces them with `/api/dashboard` results when available.

## Live weather normalization

Open-Meteo current conditions update only the Weather factor. SafeGo converts WMO weather codes, hourly precipitation, and wind gusts into separate 0–100 severities and uses the highest severity as the weather score. The normal risk model then recalculates the overall result alongside any configured official and flood/road feeds. Weather observations expire after ten minutes; provider failure leaves the stored location data in place and marks the feed as degraded.

This is modeled weather, not a PAGASA warning. It never creates or modifies an official advisory, flood report, school notice, or community verification status.

## Operational source ingestion

SafeGo now has provider-swappable adapters for normalized official-advisory and flood/road feeds. Both are disabled by default. When configured, active non-expired entries are matched only to canonical SafeGo location IDs, displayed with source links, and used to replace the corresponding stored factor before the existing risk model recalculates. Invalid or unavailable feeds are marked degraded and leave stored fallback signals intact.

See [docs/SOURCE_FEEDS.md](docs/SOURCE_FEEDS.md) for the required contracts and source-approval checklist. The app does not scrape PAGASA pages or assume Geoportal hazard layers are live operational observations.

## Route-risk model

OSRM supplies road geometry and road names. SafeGo samples that geometry and assigns each section the already-calculated overall score of its nearest SafeGo location. Segment length is used internally only to weight the safety score; SafeGo does not present trip distance or arrival-time estimates. If any section is High or Critical, the final trip score cannot fall below that same safety band.

Route colors are therefore an approximate coverage model—not live traffic measurements or proof that a road is safe. The UI displays how far the weakest-covered route section is from its assigned risk point.

## Public geocoding and routing services

The development defaults use the public Nominatim and OSRM services. Nominatim is queried only after form submission, never for autocomplete; requests are serialized to at most one per second and successful results are cached for 24 hours. The app sends an identifying User-Agent and displays OpenStreetMap attribution.

Before production traffic, set `SAFEGO_CONTACT_EMAIL`, review the [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/), and replace `SAFEGO_GEOCODING_BASE_URL` and `SAFEGO_ROUTING_BASE_URL` with suitable hosted or self-hosted services.

## Risk model

The travel-risk score is calculated from five normalized inputs:

- Flood and road conditions: 40%
- Weather severity: 25%
- Official advisories: 20%
- Community reports: 10%
- School status: 5%

Scores of 0–29 are Low, 30–59 Moderate, 60–79 High, and 80–100 Critical.
As a safety guardrail, a flood/road score of 70 or higher cannot produce an
overall rating below High, and a score of 85 or higher cannot produce a rating
below Critical. Severe weather (85+) supported by an elevated official advisory
(70+) also cannot produce a rating below High.

## Community report intake

The Reports screen is read-only by default. `POST /api/reports` rejects submissions unless both `SAFEGO_COMMUNITY_REPORTS_ENABLED=true` and `SAFEGO_MODERATION_ENABLED=true`. This prevents the unfinished intake code from collecting public reports before verification and abuse handling exist.

PostgreSQL mode stores reports permanently. Mock mode stores submissions only for the lifetime of the current Next.js server process. Database seeds now replace fixture reports without deleting community submissions.

Before production use, replace the in-memory rate limit with a shared durable limiter, add moderation and abuse handling, and publish retention/privacy rules.

## Still out of scope

- Approved direct PAGASA, LGU, school, traffic, or flood-provider contracts
- GPS/device-location access
- Turn-by-turn navigation, arrival-time estimates, or road-level risk sensors
- Precise hazard boundaries
- Report verification and moderation workflow
- Accounts
