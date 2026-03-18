# AGENTS.md

Air quality web app for Poland (Next.js 16, TypeScript, Supabase, Leaflet, Recharts, D3).

## Start here

`docs/build-plan.md` is **complete**. Do not re-execute its steps.

Before writing any code, read these files in this order:

1. `docs/pre-build-notes.md` — read this first; critical data corrections and wiring notes
2. `docs/feature-build-plan-v2.md` — find the first incomplete step, execute it
3. `docs/file-tree.md` — verify your output matches the expected structure
4. `src/lib/aqi-config.ts` — every AQI value you need is here
5. `docs/ui-component-reference.md` — exact TypeScript interfaces for every component
6. `BUGS.md` — read all principles before writing any code

## Non-negotiable rules

- All AQI colours, thresholds, copy strings, and benchmark numbers come from `src/lib/aqi-config.ts` — never hardcode them
- New components use inline styles, not Tailwind classes
- TypeScript strict mode — no `any`
- `"use client"` on any component using browser APIs or stateful hooks
- Polish identity colours (`#D4213D`, `#E9E8E7`) only in: `Navbar`, `PolishFlagIcon`, `SourceBadge`, `LanguageSwitcher`
- Never modify protected files — see `docs/file-tree.md` for the full list
- Never modify `data/local.db` directly — only harvest scripts in `scripts/` write to it
- Never modify `scripts/*.py` during the feature build

## Commands

```bash
npm run dev          # local dev server
npx tsc --noEmit     # type check — must pass before every commit
npm run build        # production build
npm run lint         # ESLint
```

## How to execute a build step

Each step in `docs/feature-build-plan-v2.md` specifies: READS / PRODUCES / INSTRUCTIONS / CONSTRAINTS / VERIFY / COMMIT.
Follow that structure exactly. One commit per step. Use the exact commit message string from the step.

## If something is ambiguous

Check `docs/ui-component-reference.md` for component interfaces.
Check `docs/file-tree.md` for correct file paths.
Check `src/lib/aqi-config.ts` for any value that might come from config.
Check `docs/pre-build-notes.md` for data layer gotchas.
Do not guess — stop and ask.

## When you find or fix a bug

1. Fix the code first
2. Add an entry to `BUGS.md` following the format in `HOW-TO-LOG-BUGS.md`
3. If the principle has appeared before or cannot be machine-enforced, add it to the "Hard-won rules" section below
4. Commit the fix, the BUGS.md entry, and any AGENTS.md update together

## Hard-won rules

Principles promoted from BUGS.md after proving their worth. Each starts with the BUG-N or DATA-N reference.

### Leaflet tile URLs (BUG-1)
Before writing any Leaflet `tileLayer` URL, verify it returns HTTP 200:
```bash
curl -s -o /dev/null -w "%{http_code}" "<tile_url_with_real_z_x_y>"
```
Use the working CartoDB format — no subdomains:
```
https://basemaps.cartocdn.com/rastertiles/<style>/{z}/{x}/{y}{r}.png
```
Valid styles: `voyager` (light, recommended), `light_all`, `dark_matter_all`.
The old subdomain format `https://{s}.basemaps.cartocdn.com/dark_matter/...` returns 404 — never use it.

### Leaflet z-index clearance (BUG-2)
Any `position: fixed` overlay (modal, drawer, toast, tooltip) on a page that contains a Leaflet map must use `zIndex` ≥ 2000.
Leaflet's internal layers: tile pane = 200, marker pane = 400, popup pane = 600.
A backdrop at z-index 100 will be covered by map tiles. 2000 is the minimum safe value.

### fitBounds for city views (BUG-3)
When `PolandMap` receives a filtered city station set (≤ 50 stations, no `focusStationId`), always use:
```ts
map.fitBounds(
  L.latLngBounds(stations.map(s => [s.lat, s.lon] as [number, number])),
  { padding: [48, 48], maxZoom: 13 }
);
```
Never fall back to a fixed centre point for a multi-station city view — the stations may be spread across the city and a fixed centre will be wrong.

### SQLite concurrent write timeout (BUG-6)
Every SQLite connection in a harvest script MUST use `timeout=30`:
```python
conn = sqlite3.connect(DB_PATH, timeout=30)
```
Never use bare `sqlite3.connect(path)` — the default timeout (5 s or 0 s depending on build) causes silent data loss when two scripts write concurrently. `PRAGMA journal_mode=WAL` reduces contention but does not eliminate write lock timeouts. 30 seconds exceeds the duration of any single transaction in these scripts.

### Time-window flag for harvest scripts (BUG-7)
Every script that fetches time-series data MUST accept a `--days-back N` argument:
```python
parser.add_argument("--days-back", type=int, default=None,
                    help="Discard data points older than N days from now")
```
Default (no flag) = store everything the API returns. When set, filter rows **before** inserting — never rely on the API to honour a time window. Document the flag with usage examples in the module docstring. Log the value in `harvest_log.notes` so runs are distinguishable in history.

### Always record failed fetches in harvest state (BUG-8)
When a sensor fetch fails (any HTTP error, empty response, exception), still write it to `sensor_harvest_state` with `total_rows=0`:
```python
conn.execute("""
    INSERT INTO sensor_harvest_state (sensor_id, station_id, last_fetched, oldest_date, total_rows)
    VALUES (?,?,?,NULL,0)
    ON CONFLICT(sensor_id) DO UPDATE SET last_fetched = excluded.last_fetched
""", (sensor_id, station_id, now_iso()))
```
Never skip state recording on the error path. An unrecorded sensor stays in the todo list forever and wastes 31 seconds of rate-limit budget on every subsequent run. Use `--refetch N` as the intentional retry mechanism for sensors you want to retry.

### `readings.aqi_level` stores internal keys, not display strings (DATA-1)
Rows in `readings` (written by `harvest-aqi-snapshot.py`) store internal keys like `"bardzo_dobry"`, `"zly"`, `"brak_indeksu"` — NOT Polish display strings like `"Bardzo dobry"`.
Do NOT call `giosLabelToKey()` on `readings.aqi_level` — it already IS the key.
`giosLabelToKey()` is only for `StationSummary.aqi.level_name` which comes from the static JSON snapshot.
Treat `"brak_indeksu"` and `NULL` as `"no_data"` in all API routes:
```typescript
const levelKey: AqiLevelKey = (
  r.aqi_level === "brak_indeksu" || !r.aqi_level ? "no_data" : r.aqi_level
) as AqiLevelKey;
```

### `readings.pm25` from AQI snapshots are index scores, not µg/m³ (DATA-2)
Rows where `sensor_id IS NULL` (AQI snapshots from `harvest-aqi-snapshot.py`) store GIOŚ index values (0–5 scale × 10) in the pm25/pm10/no2 columns. These are NOT real concentration values.
Real µg/m³ values only exist in rows where `sensor_id IS NOT NULL` (from `harvest-readings.py`).
All concentration-based queries (charts, percentile bands, trend analysis) MUST filter:
```sql
WHERE sensor_id IS NOT NULL AND pm25 IS NOT NULL
```
Never mix index scores with concentration values in the same computation. Passing an index score of `3.0` to `pm25ToLevelKey()` returns `"bardzo_dobry"` — technically valid but semantically wrong.
