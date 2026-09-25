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

### App (Next.js + Java API)

Install Node.js and Java 21. On Windows, start both services from the project root:

```bash
npm install
npm run dev
```

SafeGo needs a JDK 21, not a Java 8 runtime or JDK 27. The launcher uses
`SAFEGO_JAVA_HOME` or `JAVA_HOME` when they point to JDK 21, and also detects a
user-local Microsoft JDK 21 under `%LOCALAPPDATA%\Programs\SafeGoJdk21`.
If another Java version is your system default, set the JDK for this terminal
without changing your system-wide configuration:

```powershell
$env:SAFEGO_JAVA_HOME = 'C:\path\to\jdk-21'
npm run dev
```

Open `http://localhost:3000` in your browser. The UI runs on port 3000 and the Java API on port 8080. The first run downloads Gradle dependencies and may take a few minutes. Keep the terminal open. If port 3000 is already in use, stop the older Next.js server or open the port shown in the terminal.

For separate terminals, run `npm run dev:api` and `npm run dev:web`. `npm run dev:web` alone shows stored demo data but cannot fetch live weather or analyze trips. The Java launcher reads `.env` and `.env.local` from the project root.

For a production-style local demo, verify the build, then keep the API and UI running in separate terminals:

```bash
npm run check:demo
```

Run `npm run dev:api` in one terminal and `npm run demo` in another. `npm run demo` builds first and then serves the production build on port 3000.

The default `.env.example` configuration uses `SAFEGO_DATA_MODE=mock` for a stable demo. If the variable is omitted, `auto` mode uses PostgreSQL only when `DATABASE_URL` is configured and otherwise falls back to the built-in dataset.

The dashboard requests a fresh snapshot when it opens, when the user presses Refresh, and every five minutes while the page remains open. Set `SAFEGO_WEATHER_PROVIDER=disabled` for fully offline development.

### Java Spring Boot server

Requires Java 21. From `server/demo/`:

```bash
./gradlew bootRun
```

The server starts on port 8080. All `/api/*` requests are forwarded to it by Next.js. It loads the built-in dataset or the existing PostgreSQL/PostGIS schema, applies live weather and configured feeds, and calculates route risks.

Refer to `server/API.md` for the API documentation.


### PostgreSQL/PostGIS data mode

Create a PostgreSQL database with PostGIS available, copy `.env.example` to `.env.local`, and update `DATABASE_URL`. Then run:

```bash
npm run db:setup
npm run dev
```

Set `SAFEGO_DATA_MODE=database` to require the database. Use `mock` to force the local fixtures, or `auto` to use the database only when `DATABASE_URL` is present.

The database commands are repeatable: migrations are recorded in `schema_migrations`, and seeding replaces each preset location's observations, advisories, reports, and current assessment without duplicating them.

## Flow

1. Check a supported area such as Pasig, optionally add a destination, or load the stable España-to-Lerma pilot example.
2. SafeGo resolves both places, identifies the connecting road route, and checks its sections against the four pilot risk points within the provisional 850-meter limit.
3. Review the route score, compact map, road conditions, announcements, and major roads.
4. Select **Plan another trip** to start again.

## Screens

| Screen       | Contents                                                          |
| ------------ | ----------------------------------------------------------------- |
| Search       | Location field, result list, suggested areas                      |
| Overview     | Route score, compact risk map, current conditions, announcements, nearby university statuses, and major roads |
| Risk factors | SafeGo risk points and factors covering the route                  |
| Announcements | Official, school, and local updates near the area or route         |
| Map          | Real road route with green/yellow/orange/red risk sections         |
| Conditions   | Hazards and community observations near the route                  |
| Reports      | Optional moderated community-report workflow; hidden when disabled |

Nearby university entries are tied to the selected SafeGo area rather than shown
citywide. The current entries are labeled demo data; a suspension must not be
treated as official until an approved university or government source is connected.
The UI shows an announcement link only when the stored URL points to a confirmed,
post-level notice from the university or its central student council. General
homepages and social-media profiles are not treated as announcement evidence.

Sidebar on desktop. Top bar and bottom tabs on smaller screens.

## Application structure

The Next.js app is independent from the original static prototype:

- `components/safego/` contains the React interface and interactive map.
- `lib/safego/locations.ts` is the current mock-data source.
- `lib/safego/risk-model.ts` contains the versioned risk calculation.
- `lib/safego/types.ts` defines the shared domain contracts for future APIs.
- `server/demo/` contains the active Java API, repositories, providers, and risk calculation.
- `lib/data/` retains the earlier TypeScript implementation as a reference for parity checks; it is not an active API runtime.
- `db/migrations/` contains the PostgreSQL/PostGIS schema.
- `scripts/db-migrate.ts` and `scripts/db-seed.ts` set up local or hosted databases.
- `prototype/` remains available as the original design reference only.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the runtime data flow, trust boundaries, and pre-push checklist.

## Data APIs

| Endpoint | Purpose |
| --- | --- |
| `GET /api/locations` | Lists map/search locations with coordinates and current risk |
| `GET /api/locations/:id/risk` | Returns the assessment, factors, advisories, and reports for one location |
| `GET /api/sources/status` | Shows whether feeds are mock, active, degraded, or disabled |
| `GET /api/dashboard` | Combines stored SafeGo signals with current modeled weather for the UI |
| `POST /api/trips/analyze` | Resolves A and B, identifies connecting roads, and calculates route risk |
| `POST /api/reports` | Disabled unless both community intake and moderation are explicitly enabled |

Responses include `meta.backend` (`mock` or `database`) and `meta.generatedAt`. The dashboard service keeps an assembled snapshot in memory for one minute, while successful OSRM routes are cached for ten minutes. The UI starts with local fixtures for an instant render and replaces them with `/api/dashboard` results when available.

## Live weather normalization

Open-Meteo current conditions update only the Weather factor. SafeGo converts WMO weather codes, hourly precipitation, and wind gusts into separate 0–100 severities and uses the highest severity as the weather score. The normal risk model then recalculates the overall result alongside any configured official and flood/road feeds. The Java dashboard caches its assembled snapshot for one minute; provider failure leaves the stored location data in place and marks the feed as degraded.

This is modeled weather, not a PAGASA warning. It never creates or modifies an official advisory, flood report, school notice, or community verification status.

## Operational source ingestion

SafeGo now has provider-swappable adapters for normalized official-advisory and flood/road feeds. Both are disabled by default. When configured, active non-expired entries are matched only to canonical SafeGo location IDs, displayed with source links, and used to replace the corresponding stored factor before the existing risk model recalculates. Invalid or unavailable feeds are marked degraded and leave stored fallback signals intact.

See [docs/SOURCE_FEEDS.md](docs/SOURCE_FEEDS.md) for the required contracts and source-approval checklist. The app does not scrape PAGASA pages or assume Geoportal hazard layers are live operational observations.

## Route-risk model

OSRM supplies road geometry and road names. SafeGo preserves road bends, splits long edges, and scores only sections covered by pilot points in España, Lerma, Quiapo and Mapúa Makati. Coverage is weighted by length. Below 90% coverage, the route remains visible but its overall score is null and unknown sections are gray and dashed. When a rating is available, High and Critical covered sections preserve their safety floors. These pilot limits are provisional and require external validation.

Successful OSRM routes are cached in memory for ten minutes. Loading the stable demo trip uses a bundled OSRM geometry snapshot captured on September 14, 2026; the same snapshot is also the fallback for that exact example if live routing is unavailable. The interface labels saved geometry, and arbitrary trips never receive invented routes. Set `SAFEGO_DEMO_ROUTE_FALLBACK=false` to disable it.

Route colors are an approximate coverage model, not live traffic measurements or proof that a road is safe. The UI shows coverage percentage, unknown sections and source information. See [PILOT_VALIDATION.md](docs/PILOT_VALIDATION.md) for the policy, API changes, historical review checklist and usability protocol. Run `npm run validate:risk` for curated synthetic scenarios, or open `/validation` during `npm run dev` to review them interactively. No real user or historical validation has been completed yet.

## Public geocoding and routing services

The development defaults use the public Nominatim and OSRM services. Nominatim is queried only after form submission, never for autocomplete; requests are serialized to at most one per second and successful results are cached for 24 hours. The app sends an identifying User-Agent and displays OpenStreetMap attribution.

Before production traffic, set `SAFEGO_CONTACT_EMAIL`, review the [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/), and replace `SAFEGO_GEOCODING_BASE_URL` and `SAFEGO_ROUTING_BASE_URL` with suitable hosted or self-hosted services.

## Risk model

The travel-risk score is calculated from five normalized inputs:

- Flood and road conditions: 40%
- Weather severity: 25%
- Official announcements and advisories: 20%
- Community reports: 10%
- Nearby university or school status: 5%

Scores of 0–29 are Low, 30–59 Moderate, 60–79 High, and 80–100 Critical.
As a safety guardrail, a flood/road score of 70 or higher cannot produce an
overall rating below High, and a score of 85 or higher cannot produce a rating
below Critical. Severe weather (85+) supported by an elevated official advisory
(70+) also cannot produce a rating below High.

## Community report intake

Reports navigation is hidden by default. It appears only when both `SAFEGO_COMMUNITY_REPORTS_ENABLED=true` and `SAFEGO_MODERATION_ENABLED=true`; `POST /api/reports` rejects submissions otherwise. This prevents the unfinished intake code from collecting public reports before verification and abuse handling exist.

PostgreSQL mode stores reports permanently. Mock mode stores submissions only for the lifetime of the current Java server process. Database seeds now replace fixture reports without deleting community submissions.

Before production use, replace the in-memory rate limit with a shared durable limiter, add moderation and abuse handling, and publish retention/privacy rules.

## Still out of scope

- Approved direct PAGASA, LGU, school, traffic, or flood-provider contracts
- GPS/device-location access
- Turn-by-turn navigation, arrival-time estimates, or road-level risk sensors
- Precise hazard boundaries
- Report verification and moderation workflow
- Accounts
