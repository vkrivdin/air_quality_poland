# BUGS.md — Powietrze bug ledger

This file records bugs that were found, fixed, and generalised into permanent rules.
It is a living document. Every entry follows the same structure.

**How to use this file:**
- When a bug is fixed, add an entry here immediately, in the same commit as the fix
- Extract the *design principle* — not just the fix — so the whole class of problem is prevented
- Keep each entry short: the principle is more important than the story
- When a principle is mature (seen twice), promote it to AGENTS.md

---

## Entry format

```
### BUG-N — Short title
**Date:** YYYY-MM-DD
**Phase:** which build phase this was caught in
**Symptom:** what the agent or developer observed
**Root cause:** the design mistake, not the surface error
**Fix:** what was changed
**Principle:** the rule that prevents this entire class of bug — written as a constraint an agent can follow
**Added to AGENTS.md:** yes / no / pending
```

---

## Entries

### BUG-1 — CartoDB tile URL format dead
**Date:** 2026-03-15
**Phase:** Phase 4c (map fix)
**Symptom:** Map container rendered with correct dimensions and circle markers, but no tile imagery — only a dark background. Leaflet logged no error.
**Root cause:** Missing verification — the tile URL `https://{s}.basemaps.cartocdn.com/dark_matter/{z}/{x}/{y}{r}.png` was written without confirming it returns HTTP 200. The subdomain format is deprecated; CartoDB now serves tiles from `basemaps.cartocdn.com/rastertiles/<style>/`.
**Fix:** Switched tile URL to `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png` in `src/app/components/PolandMap.tsx`. Also updated popup text colours from dark-theme greys to light-theme CSS tokens.
**Principle:** Before writing any Leaflet `tileLayer` URL, verify it returns HTTP 200 with `curl -s -o /dev/null -w "%{http_code}" "<tile_url>"`. Use the working CartoDB URL format: `https://basemaps.cartocdn.com/rastertiles/<style>/{z}/{x}/{y}{r}.png` (no subdomains). Valid styles: `voyager`, `light_all`, `dark_matter_all`.
**Added to AGENTS.md:** yes

---

### BUG-2 — Modal z-index below Leaflet tile pane
**Date:** 2026-03-15
**Phase:** Phase 3 (ComplianceModal, surfaced in Phase 4c)
**Symptom:** Opening `ComplianceModal` (triggered by the "3× powyżej normy UE 2030" badge in the Kraków city panel) showed the backdrop and dialog box, but the Leaflet map tiles bled through the overlay.
**Root cause:** Missing constraint — `ComplianceModal` used `zIndex: 100` on its backdrop. Leaflet internally assigns z-index 200 (tile pane), 400 (marker pane), and 600 (popup pane) to its layers. Any `position: fixed` overlay must sit above all of these.
**Fix:** Changed `ComplianceModal` backdrop from `zIndex: 100` to `zIndex: 2000` in `src/app/components/ComplianceModal.tsx`.
**Principle:** Any `position: fixed` overlay (modal, drawer, toast, tooltip) that appears on a page containing a Leaflet map must use `zIndex` ≥ 2000. Leaflet's highest internal layer (popup pane) uses z-index 600; 2000 provides safe clearance above all Leaflet layers and any overlay stacking within them.
**Added to AGENTS.md:** yes

---

### BUG-3 — City selection did not zoom map to selected city
**Date:** 2026-03-15
**Phase:** Phase 4c (city search)
**Symptom:** Selecting a city via the search bar (e.g. Warszawa) navigated to `/?city=warszawa` and rendered the correct city panel, but the map stayed zoomed out to the full Poland view instead of zooming to Warsaw's stations.
**Root cause:** Missing constraint — `PolandMap.tsx` only used `focusStationId` (a single station) to set the initial viewport. When a city panel is shown with multiple stations and no single focus station, the fallback was always `center: [51.9, 19.1], zoom: 6` (Poland default). There was no `fitBounds` path for multi-station city views.
**Fix:** Added a three-way viewport decision in `PolandMap.tsx`: (1) single `focusStationId` → `setView` at zoom 12; (2) ≤50 stations (city view) → `fitBounds` with 48px padding and maxZoom 13; (3) >50 stations (national view) → leave at Poland default.
**Principle:** When `PolandMap` receives a filtered set of stations for a city view (≤50 stations, no `focusStationId`), always call `map.fitBounds(L.latLngBounds(stations.map(s => [s.lat, s.lon])), { padding: [48, 48], maxZoom: 13 })` after adding the tile layer. Never assume a single centre point is sufficient for a multi-station city view.
**Added to AGENTS.md:** yes

---

### BUG-4 — Delivery zip had extra wrapper folder, breaking tsc on user's machine
**Date:** 2026-03-15
**Phase:** Phase 4 delivery
**Symptom:** User ran `unzip -o phase4-changes.zip` in the project root. The zip unpacked into a `phase4-delivery/` subfolder. Running `npx tsc --noEmit` produced 5 "Cannot find module" errors because `PageShell.tsx` resolved its sibling imports relative to `phase4-delivery/src/app/components/` where no other components existed.
**Root cause:** Missing verification — the zip was built from `/tmp/phase4-delivery/` using `cd /tmp && zip -r ... phase4-delivery/`, which embedded the wrapper directory name. The correct method is to `cd` into the project root and zip individual paths starting with `src/`.
**Fix:** All subsequent deliveries built with `cd /home/user/workspace/powietrze && zip -r output.zip src/path/to/file ...` so paths inside the zip start from `src/` and unzip directly into the project root.
**Principle:** Always build delivery zips from the project root (`cd /home/user/workspace/powietrze`) using relative paths that start with `src/` or the file's natural location. Never zip a staging directory — the resulting paths will include the staging directory name and break on the user's machine. Verify with `unzip -l <file>.zip` before sharing: every path must start with `src/`, `docs/`, or another project-root-relative prefix, never with a delivery folder name.
**Added to AGENTS.md:** no

---

### BUG-5 — Non-Kraków city panel had no summary card
**Date:** 2026-03-15
**Phase:** Phase 7–8 wiring (caught during visual testing)
**Symptom:** Selecting Kraków showed a full AqiDashboardCard with coloured header, activity matrix, and pollutant stats. Selecting any other city (e.g. Warszawa) showed only a flat station list with AQI badges — no summary, no context, no visual weight at the top of the panel.
**Root cause:** `CityPanel.tsx` hard-gated the `AqiDashboardCard` behind `isKrakow` because only Kraków has hourly readings. No fallback summary was provided for cities with only `StationSummary[]` data.
**Fix:** Added `CitySummaryCard` component inside `CityPanel.tsx`. For non-Kraków cities it computes dominant level, station count breakdown, best/worst station name, and latest `calc_date` directly from `StationSummary[]`. Same visual structure (coloured header band + body) as `AqiDashboardCard` — consistent weight without requiring hourly data.
**Principle:** Every city view must open with a summary card above the station list. If hourly readings are unavailable, derive the summary from `StationSummary[]` (dominant level, breakdown, best/worst station). Never show a bare station list as the first thing in a city panel.
**Added to AGENTS.md:** no

---

---

### BUG-6 — SQLite "database is locked" under concurrent harvest scripts
**Date:** 2026-03-18
**Phase:** Local data collection (harvest scripts)
**Symptom:** Running `harvest-aqi-snapshot.py` while `harvest-sensors.py` or `harvest-readings.py` was already running in the background produced repeated `⚠ insert error: database is locked` warnings. Some rows were silently skipped. Final counts appeared correct only because the fast snapshot happened to retry past the window.
**Root cause:** All four harvest scripts called `sqlite3.connect(DB_PATH)` with no `timeout` argument. The default SQLite timeout is 5 seconds (some builds 0 seconds). When two scripts tried to write simultaneously, the second one failed immediately instead of waiting for the first to release the lock.
**Fix:** Changed every `sqlite3.connect(DB_PATH)` call in all four harvest scripts to `sqlite3.connect(DB_PATH, timeout=30)`. 30 seconds is longer than any single transaction in these scripts, so the second writer will always wait and succeed rather than error.
**Principle:** Every SQLite connection in harvest scripts (or any script that may run concurrently with another writer) MUST use `sqlite3.connect(path, timeout=30)`. Never use the bare `sqlite3.connect(path)` default — it will produce silent data loss when two processes write at the same time. This applies even with `PRAGMA journal_mode=WAL` — WAL reduces contention but does not eliminate write lock timeouts.
**Added to AGENTS.md:** yes

---

### BUG-7 — harvest-readings.py had no time-window filter (--days-back missing)
**Date:** 2026-03-18
**Phase:** Local data collection (harvest scripts)
**Symptom:** There was no way to restrict the harvest to a specific time window. The script fetched whatever the GIOŚ API returned (~3 days) and stored all of it. Users wanting a year of history (build up over many daily runs) or a single week of data had no mechanism to discard out-of-window rows.
**Root cause:** The script was written to "fetch all available data" without considering that the caller needs control over the time window, both to limit DB size and to express intent ("I want the last 7 days" vs "I want the last year").
**Fix:** Added `--days-back N` argument to `harvest-readings.py`. When set, any data point whose `measured_at` is older than `now - N days` is discarded before insert. The flag is optional — omitting it keeps original behaviour (store everything returned by the API). Added `notes` column logging to `harvest_log` so runs with `--days-back` are distinguishable in the history.
**Principle:** Any harvest script that fetches time-series data MUST expose a `--days-back N` flag. Default behaviour (no flag) should be maximally inclusive (keep everything). When the flag is set, filter data points before inserting — never rely on the API to truncate the window for you. Document the flag clearly in the module docstring with examples.
**Added to AGENTS.md:** yes

---

### BUG-8 — harvest-readings.py retried HTTP 400 sensors on every run
**Date:** 2026-03-18
**Phase:** Local data collection (harvest scripts)
**Symptom:** Sensors returning `HTTP Error 400` (retired/invalid GIOŚ sensor IDs) were attempted on every single run of `harvest-readings.py`. They wasted 31 seconds per sensor per run and cluttered the log with known-bad errors.
**Root cause:** The `if not data: continue` path skipped recording the sensor in `sensor_harvest_state`. Only successful fetches were tracked. So failed sensors stayed in the "never fetched" bucket and were included in every `todo` list.
**Fix:** Added an `INSERT ... ON CONFLICT DO UPDATE` into `sensor_harvest_state` in the error path, recording `total_rows=0` and `last_fetched=now`. On the next default run the sensor is skipped. Use `--refetch N` to force a retry after N days if needed.
**Principle:** A failed fetch (HTTP error, empty response) MUST still write a record to `sensor_harvest_state` with `total_rows=0`. Never leave a sensor unrecorded after attempting it — unrecorded sensors get retried every run, wasting rate-limit budget and polluting logs with known-permanent errors. Use `--refetch N` as the intentional retry mechanism.
**Added to AGENTS.md:** yes

---

## Promoted principles

Principles that have appeared in two or more bugs are promoted to AGENTS.md and marked here.

- **BUG-1** → Leaflet tile URL verification rule → promoted to AGENTS.md `## Hard-won rules`
- **BUG-2** → Leaflet z-index clearance rule → promoted to AGENTS.md `## Hard-won rules`
- **BUG-3** → fitBounds for city views rule → promoted to AGENTS.md `## Hard-won rules`
- **BUG-6** → SQLite concurrent write timeout rule → promoted to AGENTS.md `## Hard-won rules`
- **BUG-7** → Time-window flag for harvest scripts → promoted to AGENTS.md `## Hard-won rules`
