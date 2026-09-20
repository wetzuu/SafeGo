# SafeGo Java API

**Base URL:** `http://localhost:8080`

All responses follow the same envelope:

```json
{
  "data": <payload>,
  "meta": {
    "backend": "mock",
    "generatedAt": "2026-09-20T12:36:06Z"
  }
}
```

Errors skip `data` and return `"error"` instead:

```json
{ "error": { "code": "SOME_CODE", "message": "Human-readable reason." } }
```

All endpoints set `Cache-Control: no-store`.

---

## GET /api/locations

Lists every SafeGo location with its current risk summary.

**Response `data`:** array of location objects.

```json
[
  {
    "id": "espana",
    "name": "España Blvd., Sampaloc",
    "city": "Manila",
    "aliases": ["espana", "españa", "sampaloc", "morayta"],
    "coordinates": [14.612, 120.9902],
    "updated": "6:42 AM",
    "risk": {
      "key": "mod",
      "name": "MODERATE RISK",
      "rank": "Level 2 of 4",
      "percentage": 54,
      "modelVersion": "1.0.0"
    }
  }
]
```

**Risk keys:** `low` · `mod` · `high` · `crit`

**Known IDs:** `espana`, `mapua-makati`, `quiapo`, `lerma`, `binondo`, `katipunan`, `ortigas-pasig`

---

## GET /api/locations/:id/risk

Full risk detail for one location.

**Response `data`:**

```json
{
  "location": { /* same shape as one item from /api/locations */ },
  "assessment": {
    "key": "mod",
    "name": "MODERATE RISK",
    "rank": "Level 2 of 4",
    "percentage": 54,
    "rawScore": 54,
    "safetyRule": "",
    "contributions": [
      { "name": "Weather",             "score": 58, "weight": 0.25, "points": 14.5 },
      { "name": "Flood / roads",       "score": 52, "weight": 0.40, "points": 20.8 },
      { "name": "Official advisories", "score": 70, "weight": 0.20, "points": 14.0 },
      { "name": "School status",       "score": 20, "weight": 0.05, "points": 1.0  },
      { "name": "Community reports",   "score": 40, "weight": 0.10, "points": 4.0  }
    ],
    "summary": "Moderate rainfall and localized street flooding...",
    "status": "Passable, delays likely",
    "modelVersion": "1.0.0"
  },
  "factors": [
    {
      "name": "Weather",
      "score": 58,
      "pill": "mod",
      "pillText": "Moderate",
      "description": "Heavy rain since 4:30 AM...",
      "icon": "weather",
      "tone": "icon-weather"
    }
  ],
  "advisories": [
    {
      "source": "weather",
      "label": "PAGASA",
      "title": "Orange Rainfall Warning for Metro Manila",
      "description": "...",
      "time": "6:15 AM",
      "date": "Sep 14, 2026",
      "isMock": true
    }
  ],
  "communityReports": [
    {
      "type": "Flooding",
      "title": "Ankle-deep flooding",
      "meta": "España Blvd. corner Morayta · 6:20 AM",
      "status": "pending",
      "statusLabel": "Pending"
    }
  ]
}
```

**`safetyRule`** is a non-empty string when a safety floor overrode the raw score.

**Errors:**

| Status | Code | When |
| --- | --- | --- |
| 404 | `LOCATION_NOT_FOUND` | `:id` doesn't match any known location |

---

## GET /api/sources/status

Shows health of configured data feeds.

**Response `data`:** array of source objects.

```json
[
  {
    "key": "prototype-mock",
    "name": "SafeGo prototype dataset",
    "kind": "mock",
    "status": "mock",
    "lastSuccessAt": null,
    "lastFailureAt": null,
    "errorMessage": null
  }
]
```

**Status values:** `mock` · `active` · `degraded` · `disabled`

---

## GET /api/dashboard

Combined snapshot for the UI: all locations plus source statuses.

**Response `data`:**

```json
{
  "locations": [ /* full SafeGoLocation objects — same shape as what locations/:id/risk returns inside "location", but with all fields */ ],
  "sources":   [ /* same shape as /api/sources/status data array */ ],
  "weatherUpdatedAt": null
}
```

`weatherUpdatedAt` is `null` on the Java server until the weather provider is ported. The Next.js server may return an ISO timestamp here.

---

## POST /api/trips/analyze

Resolves origin and destination, finds a road route, and scores each segment by risk.

**Request body:**

```json
{
  "origin": "espana",
  "destination": "lerma",
  "preferSavedDemo": true
}
```

| Field | Type | Notes |
| --- | --- | --- |
| `origin` | string | Place name or preset location ID. Max 160 chars. |
| `destination` | string | Place name or preset location ID. Max 160 chars. Must differ from `origin`. |
| `preferSavedDemo` | boolean | Optional. `true` uses the bundled España↔Lerma geometry instead of calling OSRM live. |

Preset IDs (matched by name/alias too): `espana`, `mapua-makati`, `quiapo`, `lerma`, `binondo`, `katipunan`, `ortigas-pasig`.
Anything else hits Nominatim (Philippines only).

**Response `data`:**

```json
{
  "origin": {
    "label": "España Blvd., Sampaloc",
    "coordinates": [14.612, 120.9902],
    "source": "preset",
    "matchedLocationId": "espana",
    "approximate": true
  },
  "destination": {
    "label": "Lerma St., Sampaloc",
    "coordinates": [14.6049, 120.9888],
    "source": "preset",
    "matchedLocationId": "lerma",
    "approximate": true
  },
  "routeCoordinates": [[14.612167, 120.990381], /* ... [lat, lng] pairs */ ],
  "roadNames": ["A. H. Lacson Avenue", "M. Earnshaw Street"],
  "riskKey": "mod",
  "riskName": "MODERATE RISK",
  "overallRiskScore": 51,
  "rawRiskScore": 51,
  "safetyRule": "",
  "coverageNote": "100.0% of this route is within the Manila–Makati pilot coverage estimate...",
  "generatedAt": "2026-09-20T12:39:31Z",
  "routingSource": "saved-demo",
  "coverage": {
    "pilotId": "manila-makati-v1",
    "status": "sufficient",
    "coveredPercent": 100.0,
    "minimumPercent": 90,
    "radiusMeters": 850.0,
    "totalMeters": 1222.87,
    "coveredMeters": 1222.87,
    "unknownMeters": 0.0,
    "longestUnknownGapMeters": 0.0
  },
  "segments": [
    {
      "coordinates": [[14.612167, 120.990381], /* ... */],
      "riskScore": 54,
      "riskKey": "mod",
      "basisLocationId": "espana",
      "basisLocationName": "España Blvd., Sampaloc",
      "lengthMeters": 637.28,
      "coverage": "covered",
      "nearestPointDistanceMeters": 558.21
    }
  ],
  "corridorLocations": [ /* full SafeGoLocation objects near the route, sorted by risk desc */ ],
  "advisories":  [ /* deduplicated Advisory objects from corridor locations */ ],
  "reports":     [ /* deduplicated CommunityReport objects */ ],
  "hazards":     [ /* deduplicated Hazard objects */ ],
  "sources":     [ /* same shape as /api/sources/status data array */ ]
}
```

**`routingSource`:** `"saved-demo"` · `"osrm"` · `"simulation"`

**`coverage.status`:** `"sufficient"` (≥ 90% covered) · `"insufficient"` — when insufficient, `overallRiskScore` and `rawRiskScore` are `null` and `riskKey` is `"unknown"`.

**`segments[].coverage`:** `"covered"` · `"unknown"` — unknown segments have `riskScore: null` and `riskKey: "unknown"`.

**Errors:**

| Status | Code | When |
| --- | --- | --- |
| 400 | `INVALID_JSON` | Malformed JSON body |
| 400 | `INVALID_TRIP` | Missing/blank/too-long origin or destination |
| 400 | `SAME_LOCATION` | Origin and destination are identical |
| 502 | `TRIP_ANALYSIS_FAILED` | Routing or geocoding failed |

---

## POST /api/reports

Community report submission. **Disabled by default** — returns 503 unless both `SAFEGO_COMMUNITY_REPORTS_ENABLED=true` and `SAFEGO_MODERATION_ENABLED=true` are set on the server.

**Request body:**

```json
{
  "locationId": "espana",
  "reportType": "Flooding",
  "locationText": "España Blvd. near Morayta",
  "description": "Ankle-deep water blocking the right lane."
}
```

| Field | Type | Constraints |
| --- | --- | --- |
| `locationId` | string | Must match a known location ID |
| `reportType` | enum | `Flooding` · `Road Hazard` · `Transport Disruption` · `Power / Signal Outage` · `Other` |
| `locationText` | string | 3–160 chars |
| `description` | string | 10–500 chars |

**Response (201):**

```json
{
  "data": {
    "type": "Flooding",
    "title": "Ankle-deep water blocking the right lane.",
    "meta": "España Blvd. near Morayta · 8:15 AM",
    "status": "unverified",
    "statusLabel": "UNVERIFIED"
  },
  "meta": { "backend": "mock", "generatedAt": "..." }
}
```

**Errors:**

| Status | Code | When |
| --- | --- | --- |
| 503 | `REPORTING_DISABLED` | Env vars not set (default) |
| 400 | `INVALID_JSON` | Malformed JSON body |
| 400 | `INVALID_REPORT` | Validation failed — see `message` |
| 404 | `LOCATION_NOT_FOUND` | `locationId` unknown |
| 429 | `RATE_LIMITED` | > 5 reports per IP in 10 minutes |

---

## Current limitations

- **No live weather.** `dashboard.weatherUpdatedAt` is always `null`. Scores reflect stored mock data only.
- **Mock data only.** All responses come from the built-in fixture dataset. No database reads.
- **In-memory rate limiting.** Restarts the server = resets rate limit state.
- **Trip geocoding** falls back to Nominatim for non-preset places; those calls hit the public OSM API.
