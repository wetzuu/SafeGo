# SafeGo architecture

## Runtime flow

```text
Browser
  -> Next.js UI
  -> Next.js route handlers
      -> SafeGo repository -> mock fixtures or PostgreSQL/PostGIS
      -> Open-Meteo -> modeled current weather
      -> approved normalized feeds -> official advisories and flood/road observations
      -> Nominatim -> submitted place lookup
      -> OSRM -> road geometry and road names
```

The browser never receives database credentials or provider configuration. External requests are made by server-only provider modules.

## Source layout

| Path | Responsibility |
| --- | --- |
| `app/` | Next.js pages, global styles, and HTTP route handlers |
| `components/safego/` | Interactive trip planner, dashboard, and Leaflet map |
| `lib/safego/` | Core location types, fixtures, and area-risk model |
| `lib/trips/` | Trip contracts and route-risk calculation |
| `lib/providers/` | External weather, geocoding, and routing adapters |
| `lib/data/` | Repository contracts, mock/PostgreSQL implementations, dashboard composition |
| `db/migrations/` | Ordered PostgreSQL/PostGIS schema migrations |
| `scripts/` | Database migration and seed commands |
| `tests/` | Pure model and repository tests |
| `prototype/` | Original static design reference; not used by Next.js at runtime |

## Data trust boundaries

- Open-Meteo changes only the Weather factor. It does not create official advisories.
- Nominatim is called only after a trip is submitted; local preset suggestions do not make network requests.
- OSRM provides road geometry and road names. SafeGo does not expose trip distance or arrival-time estimates.
- Route colors are derived only from nearby approved pilot points within the provisional 850-meter radius. Below 90% geographic coverage, the overall rating is null; unknown sections are gray and dashed. Pilot eligibility is distinct from verified operational evidence. See `docs/PILOT_VALIDATION.md`.
- Provider failures retain stored data and surface a degraded source status.
- Public report submissions are stored as unverified evidence and do not directly change a risk score.
- Official-advisory and flood/road feeds must use the normalized contracts in `docs/SOURCE_FEEDS.md`; unknown location IDs and expired items are ignored.
- Public community intake remains disabled until moderation is explicitly enabled.

## Future Java backend

When a Spring Boot backend is introduced, preserve the current JSON contracts under `app/api/`. Port repository, provider, and risk services first, point Next.js to the Java API, verify response parity, and only then remove the matching TypeScript server modules. The React/Leaflet frontend can remain unchanged.

## Before pushing

Run:

```bash
npm install
npm run check
git diff --check
git status --short
```

Only `.env.example` belongs in Git. Keep `.env`, `.env.local`, database URLs, contact details, and future provider keys local or in deployment secrets.
