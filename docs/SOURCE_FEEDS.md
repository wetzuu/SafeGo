# SafeGo operational source feeds

SafeGo does not scrape government web pages. An upstream adapter or approved provider must expose one of the normalized JSON contracts below. Configure endpoints at runtime so providers can be changed without rebuilding the app.

## Source order and current state

1. Weather/rainfall — Open-Meteo connected; modeled weather only.
2. Official advisories — normalized adapter ready; no feed approved by default.
3. Flood/road observations — normalized adapter ready; no feed approved by default.
4. Geocoding — canonical locations first, then submit-only server-side Nominatim fallback in development.
5. Community reports — read-only until moderation and abuse handling are enabled.
6. Routing/traffic — OSRM road geometry is available; it is not live traffic.

## Official-advisory contract

```json
{
  "items": [
    {
      "id": "provider-stable-id",
      "locationIds": ["espana"],
      "sourceName": "Official agency or school",
      "sourceKind": "gov",
      "title": "Advisory title",
      "description": "Plain-language advisory details",
      "severityScore": 70,
      "issuedAt": "2026-09-07T08:00:00+08:00",
      "expiresAt": "2026-09-07T14:00:00+08:00",
      "sourceUrl": "https://official.example/advisory/123"
    }
  ]
}
```

`sourceKind` must be `gov`, `school`, or `weather`. Severity must be an integer from 0–100 produced by a documented provider-specific mapping.

## Flood/road contract

```json
{
  "items": [
    {
      "id": "provider-stable-id",
      "locationIds": ["espana"],
      "sourceName": "Verified road or disaster office",
      "kind": "flood",
      "title": "Flooding at monitored road section",
      "description": "Observed depth and passability",
      "severityScore": 80,
      "observedAt": "2026-09-07T08:10:00+08:00",
      "expiresAt": "2026-09-07T09:10:00+08:00",
      "sourceUrl": "https://official.example/observation/456"
    }
  ]
}
```

`kind` must be `flood` or `road`. An empty active feed means no active item for that canonical location and replaces that factor with zero; a failed or invalid feed retains stored fallback data.

## Approval checklist

- Confirm the publisher is authoritative for the signal.
- Record licensing, attribution, redistribution, and retention requirements.
- Document polling limits and expected refresh frequency.
- Require stable IDs, issued/observed time, explicit expiry, and source URLs.
- Document the provider-specific 0–100 normalization mapping.
- Test outage, stale-data, malformed-data, and duplicate-item behavior.
- For Geoportal Philippines layers, confirm that the layer is licensed for this use and whether it is a static hazard model or a current observation before assigning it operational weight.

## Environment variables

```text
SAFEGO_OFFICIAL_ADVISORY_FEED_URL=
SAFEGO_OFFICIAL_ADVISORY_FEED_TOKEN=
SAFEGO_FLOOD_ROAD_FEED_URL=
SAFEGO_FLOOD_ROAD_FEED_TOKEN=
```

Endpoints must use HTTPS, except `localhost` during development. Responses are fetched server-side, cached for five minutes, capped at 1,000 items, and rejected when they do not match the contract.
