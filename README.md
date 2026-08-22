# SafeGo

Public travel risk information for an area during severe weather. Phase 1 is a static front-end mock covering a few Manila locations (España / Sampaloc, Intramuros, Quiapo, Lerma).

Search or pick a place, then read the risk rating, contributing factors, advisories, flood points, and community reports for that area. There is no login. Reports are not stored. Nothing here is live data.

SafeGo is informational only. It does not declare class suspensions. Follow official school and government announcements.

## Run

```
npm install
npm run dev
```

Vite serves the app and compiles Tailwind.

```
npm run build    production build to dist/
npm run preview  serve the production build
```

## Layout

```
index.html       pages and structure
safego.css       Tailwind theme tokens and component classes (@apply)
safego.js        locations, search, navigation
vite.config.js   Vite + Tailwind plugin
```

## Flow

1. Enter or select a location on the landing search.
2. Read the overview for that area (risk index, weather, school status, road condition).
3. Open Risk factors, Alerts, Conditions, or Reports for more detail.
4. Change location from the header search, sidebar, or by going back to the landing page.

Suggested chips and the search list use the mock location set. Typing filters by name, city, and aliases. Enter selects the first match.

## Screens

| Screen | Contents |
| --- | --- |
| Search | Location field, result list, suggested areas |
| Overview | Risk summary and latest advisories/reports for the selected place |
| Risk factors | Factor scores used for the rating |
| Alerts | School, government, weather, and community notices |
| Conditions | Watched points, flood notes, reported hazards |
| Reports | Public report form and recent reports |

Sidebar on desktop. Top bar and bottom tabs on smaller screens.

## Mock data

Locations and their advisories, reports, and factor scores live in `safego.js`.

## Out of scope for this phase

- Backend, database, or APIs (PAGASA, school, maps)
- Live geocoding or GPS
- Live maps
- Report verification workflow
- Accounts
