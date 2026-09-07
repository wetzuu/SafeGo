# SafeGo architecture

## Runtime flow

```text
Browser
  -> Next.js UI
  -> Next.js route handlers
      -> SafeGo repository -> mock fixtures or PostgreSQL/PostGIS
      -> Open-Meteo -> modeled current weather
      -> Nominatim -> submitted place lookup
      -> OSRM -> driving route geometry and estimated travel time
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
- OSRM provides road geometry and estimated travel time, not live traffic or road safety.
- Route colors are derived from the nearest existing SafeGo risk point and are labeled approximate.
- Provider failures retain stored data and surface a degraded source status.
- Public report submissions are stored as unverified evidence and do not directly change a risk score.

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
