# SafeGo

Student safety and travel risk monitoring during severe weather. Phase 1 is a static front-end mock for Mapúa University (Sampaloc to Intramuros commute).

The interface shows a current travel risk level, contributing factors, school and government advisories, a mocked route with flood points, and a community report form. Nothing here is live data. Login does not authenticate. Reports are not stored.

SafeGo is informational only. It does not declare class suspensions. Follow official school and government announcements.

## Run

Open `safego.html` in a browser. For local files plus scripts, a simple static server is enough:

```
python -m http.server 8080
```

Then go to `http://localhost:8080/safego.html`.

Demo login is prefilled as `admin`. Any password works.

## Layout

```
safego.html      pages and structure
css/safego.css   styles
js/safego.js     navigation, gauges, mock lists
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

Sidebar on desktop. Top bar and bottom tabs under 900px.

## Mock data

Advisories and reports live in `js/safego.js`. The risk index is hardcoded at 58% (moderate). Gauge and lists are rendered on load.

## Out of scope for this phase

- Backend, database, or APIs (PAGASA, school, maps)
- Real authentication or role checks
- Live maps or routing
- Push notifications
- Report verification workflow
