# SafeGo operational source feeds

SafeGo does not scrape government web pages. An upstream adapter or approved provider must expose one of the normalized JSON contracts below. Configure endpoints at runtime so providers can be changed without rebuilding the app.

## Source order and current state

1. Weather/rainfall — Open-Meteo connected; modeled weather, scored on current rain rate, the last 1 and 3 hours, and the next 3 hours.
2. Official advisories — PAGASA public alerts (CAP) connected by default; the normalized adapter below can add further approved feeds.
3. Flood/road observations — normalized adapter ready; no feed approved by default.
4. Geocoding — canonical locations first, then submit-only server-side Nominatim fallback in development.
5. Community reports — read-only until moderation and abuse handling are enabled.
6. Routing/traffic — OSRM road geometry is available; it is not live traffic.

## PAGASA public alerts (CAP)

- **Source:** PAGASA's Common Alerting Protocol feed, `https://publicalert.pagasa.dost.gov.ph/feeds/` (Atom listing signed CAP 1.2 alerts). Licensed CC BY 4.0; credit "PAGASA" wherever alerts are shown.
- **Contents:** General Flood Advisories (river basins, by province), Flood Bulletins, and Tropical Cyclone Alerts/Warnings. These are official *advisories*, so they feed the Official advisories factor. They are not street-level flood or road observations and do not fill the Flood / roads factor.
- **Matching:** an alert applies to a SafeGo location or map area when one of its CAP `<polygon>`s contains that point.
- **Active alerts only:** alerts that are expired, cancelled (`msgType` Cancel), all-clear (`urgency` Past or `responseType` AllClear), or referenced by a newer alert are dropped.
- **Severity mapping (0–100):** Extreme 90, Severe 70, Moderate 45, Minor 25, and anything else 25. An active official alert is never scored zero.
- **Safety:** XML parsing forbids DTDs and external entities; only CAP documents on the feed's own host are fetched; documents over 2 MB are rejected. The feed is re-read every five minutes and each CAP document is cached by URL.
- **Endpoints:** locations receive alerts through `GET /api/dashboard`; the area map reads `GET /api/alerts/active` (see `docs/API.md`).
- **Configuration:** `SAFEGO_PAGASA_CAP_FEED_URL` (default above; `disabled` turns it off, as `npm run dev:offline` does).

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
