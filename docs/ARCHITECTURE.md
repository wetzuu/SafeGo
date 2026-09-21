# SafeGo architecture

## Runtime flow

```text
Browser
  -> Next.js UI
  -> Next.js /api rewrite -> Java Spring Boot API
      -> SafeGo repository -> mock fixtures or PostgreSQL/PostGIS
      -> Open-Meteo -> modeled current weather
      -> approved normalized feeds -> official advisories and flood/road observations
      -> Nominatim -> submitted place lookup
      -> OSRM -> road geometry and road names
```

The browser never receives database credentials or provider configuration. The Java server makes external provider requests; Next.js serves the UI and forwards `/api/*`.

## Source layout

| Path | Responsibility |
| --- | --- |
| `app/` | Next.js pages and global styles |
| `components/safego/` | Interactive trip planner, dashboard, and Leaflet map |
| `lib/safego/` | Core location types, fixtures, and area-risk model |
| `lib/trips/` | Trip contracts and route-risk calculation |
| `server/demo/` | Active Java API, data loading, weather/feed ingestion, routing, and risk model |
| `lib/providers/`, `lib/data/` | Previous TypeScript backend retained for comparison; not active at runtime |
| `db/migrations/` | Ordered PostgreSQL/PostGIS schema migrations |
| `scripts/` | Database migration and seed commands |
| `tests/` | Pure model and repository tests |
| `prototype/` | Original static design reference; not used by Next.js at runtime |

## Data trust boundaries

- Open-Meteo changes only the Weather factor. It does not create official advisories.
- Nominatim is called only after a trip is submitted; local preset suggestions do not make network requests.
- OSRM provides road geometry and road names. SafeGo does not expose trip distance or arrival-time estimates.
- Successful OSRM responses are cached in memory for ten minutes. The exact built-in España-to-Lerma demo can use a dated, bundled OSRM geometry snapshot when explicitly loaded or when the public router is unavailable; arbitrary routes have no synthetic fallback.
- Route colors are derived only from nearby approved pilot points within the provisional 850-meter radius. Below 90% geographic coverage, the overall rating is null; unknown sections are gray and dashed. Pilot eligibility is distinct from verified operational evidence. See `docs/PILOT_VALIDATION.md`.
- Weather and operational-feed failures retain stored data and surface a degraded source status. Routing failures remain visible errors except for the clearly labeled built-in demo fallback.
- Public report submissions are stored as unverified evidence and do not directly change a risk score.
- Official-advisory and flood/road feeds must use the normalized contracts in `docs/SOURCE_FEEDS.md`; unknown location IDs and expired items are ignored.
- Public community intake remains disabled until moderation is explicitly enabled.

## Java backend

The Spring Boot server at `server/demo/` owns all six API endpoints. It uses the built-in fixtures by default, or the existing seeded PostgreSQL/PostGIS schema when configured. Its dashboard composes stored data, current modeled Open-Meteo weather, and optional normalized official-advisory and flood/road feeds before recalculating risk. Location and trip endpoints read that same cached snapshot. Provider failures preserve stored conditions and expose degraded source status.

The older TypeScript backend files remain for parity comparison but are not called by the frontend. Next.js forwards API requests to Java through `next.config.ts`. Java and Next.js must both run locally.

## Before pushing

Run:

```bash
npm install
npm run check
git diff --check
git status --short
```

Only `.env.example` belongs in Git. Keep `.env`, `.env.local`, database URLs, contact details, and future provider keys local or in deployment secrets.
