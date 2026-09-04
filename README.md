# SafeGo

Public travel risk information for an area during severe weather. Phase 1 is a static front-end mock covering Metro Manila.

Search or pick a place, then read the risk rating, contributing factors, advisories, flood points, and community reports for that area. There is no login. Reports are not stored. Nothing here is live data.

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

## Mock data

Locations and their advisories, reports, and factor scores live in `safego.js`.

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

## Out of scope for this phase

- Backend, database, or APIs (PAGASA, school, maps)
- Live geocoding or GPS
- Live routing or precise geographic boundaries
- Report verification workflow
- Accounts
