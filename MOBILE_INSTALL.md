# Mobile install / GitHub Pages

## 1) Edit events (optional)
`public/data/calendar.json`

Example:
```json
{ "events": [ { "date":"2026-02-15", "time":"08:30", "name":"CPI" } ] }
```

## 2) Enable Actions
Actions workflow: `.github/workflows/update-data.yml`

## 3) Enable Pages
- Build output: `dist/`
- Vite base is `./` so it works under a repo subpath.

## 4) App data source
The app fetches:
- `/data/latest.json`
- `/data/calendar.json` (optional)

Status bar shows:
- **DATA HH:MM** (asOf)
- **NEXT mm:ss** (next half-hour boundary countdown)
