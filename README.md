# SafeGo

Public travel risk information for an area during severe weather. The current build covers Metro Manila with a real interactive map, a versioned risk model, a PostgreSQL/PostGIS-ready data layer, and live modeled weather from Open-Meteo.

Search or pick a place, then read the risk rating, contributing factors, advisories, flood points, and community reports for that area. There is no login. Reports submitted through the current UI are not stored. Nothing here is live data.

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

1. Enter or select a location on the landing search.
2. Read the overview for that area (risk index, weather, school status, road condition).
3. Open Risk factors, Alerts, Map, Conditions, or Reports for more detail.
4. Change location from the header search, sidebar, or by going back to the landing page.

Suggested chips and the search list use the mock location set. Typing filters by name, city, and aliases. Enter selects the first match.

## Screens

| Screen       | Contents                                                          |
| ------------ | ----------------------------------------------------------------- |
| Search       | Location field, result list, suggested areas                      |
| Overview     | Risk summary and latest advisories/reports for the selected place |
| Risk factors | Factor scores used for the rating                                 |
| Alerts       | School, government, weather, and community notices                |
| Map          | Live OpenStreetMap with color-coded risk and factor overlays      |
| Conditions   | Watched points, flood notes, reported hazards                     |
| Reports      | Public report form and recent reports                             |

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

## Data APIs

| Endpoint | Purpose |
| --- | --- |
| `GET /api/locations` | Lists map/search locations with coordinates and current risk |
| `GET /api/locations/:id/risk` | Returns the assessment, factors, advisories, and reports for one location |
| `GET /api/sources/status` | Shows whether feeds are mock, active, degraded, or disabled |
| `GET /api/dashboard` | Combines stored SafeGo signals with current modeled weather for the UI |

Responses include `meta.backend` (`mock` or `database`) and `meta.generatedAt`. They are intentionally not cached so a refresh requests current provider data. The UI starts with local fixtures for an instant render and replaces them with `/api/dashboard` results when available.

## Live weather normalization

Open-Meteo current conditions update only the Weather factor. SafeGo converts WMO weather codes, hourly precipitation, and wind gusts into separate 0–100 severities and uses the highest severity as the weather score. The normal risk model then recalculates the overall result. Weather observations expire after ten minutes; provider failure leaves the stored location data in place and marks the feed as degraded.

This is modeled weather, not a PAGASA warning. It never creates or modifies an official advisory, flood report, school notice, or community verification status.

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

## Still out of scope

- Live PAGASA advisories and LGU, school, traffic, or flood-provider adapters
- Live geocoding or GPS
- Live routing or precise geographic boundaries
- Report verification workflow
- Accounts
