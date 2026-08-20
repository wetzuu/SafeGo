# SafeGo

Student safety and travel risk monitoring during severe weather. Phase 1 is a static front-end mock for Mapúa University (Sampaloc to Intramuros commute).

The interface shows a current travel risk level, contributing factors, school and government advisories, a mocked route with flood points, and a community report form. Nothing here is live data. Login does not authenticate. Reports are not stored.

SafeGo is informational only. It does not declare class suspensions. Follow official school and government announcements.

## Run

```
npm install
npm run dev
```

Vite serves the app and compiles Tailwind. Demo login is prefilled as `admin`. Any password works.

```
npm run build    production build to dist/
npm run preview  serve the production build
```

## Layout

```
index.html       pages and structure
safego.css       Tailwind theme tokens and component classes (@apply)
safego.js        navigation, gauges, mock lists
vite.config.js   Vite + Tailwind plugin
```

## Screens

| Screen | Contents |
| --- | --- |
| Login | Email/ID and password fields. No validation. |
| Dashboard | Risk summary, weather, school status, route condition, latest advisory, recent reports |
| Risk Analysis | Factor scores (weather, flood, advisories, school status, community reports) |
| Announcements | School, government, weather, and community items |
| Route | Static origin to campus path and listed hazards |
| Reports | Report type, location, description. Submit shows an alert. |
| Profile | Account stub, notification toggles, saved locations |

Sidebar on desktop. Top bar and bottom tabs below the `lg` breakpoint.

## Mock data

Advisories and reports live in `safego.js`. The risk index is hardcoded at 58% (moderate). Gauge and lists are rendered on load.

## Out of scope for this phase

- Backend, database, or APIs (PAGASA, school, maps)
- Real authentication or role checks
- Live maps or routing
- Push notifications
- Report verification workflow
