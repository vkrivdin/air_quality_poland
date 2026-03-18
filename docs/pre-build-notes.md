# Powietrze — Pre-Build Notes
**For:** AI coding agents | **Read before any step in `feature-build-plan-v2.md`**
**Last updated:** March 2026

---

## 1. PROJECT STATE — what is already built

`docs/build-plan.md` Phases 0–8 are **complete**. All components listed in the original `docs/file-tree.md` exist. Do not recreate them.

Components already in `src/app/components/`:
`ActivityMatrix`, `AqiBadge`, `AqiDashboardCard`, `CityPanel`, `CitySearch`, `ComplianceBadge`, `ComplianceModal`, `Footer`, `LanguageSwitcher`, `MapWrapper`, `Navbar`, `PageShell`, `PolandMap`, `PolishFlagIcon`, `PollutantChart`, `SeasonalCalendar`, `SourceBadge`, `WarningBanner`

`docs/feature-build-plan-v2.md` is already present in `docs/`. Do not recreate it.

`data/local.db` exists and is populated. Harvest scripts in `scripts/` are complete and have been run. Do not modify any `.py` script during the feature build.

---

## 2. DATA REALITY — read before writing any query or API route

### 2a. `readings.aqi_level` stores internal keys, NOT Polish display strings

`harvest-aqi-snapshot.py` normalises Polish API strings before storing. Values in `readings.aqi_level` are already internal `AqiLevelKey` values:

| Stored in DB | Meaning |
|---|---|
| `"bardzo_dobry"` | Bardzo dobry |
| `"dobry"` | Dobry |
| `"umiarkowany"` | Umiarkowany |
| `"zly"` | Zły |
| `"bardzo_zly"` | Bardzo zły |
| `"brak_indeksu"` | No index available — treat as `"no_data"` |
| `NULL` | No data returned |

**Do NOT call `giosLabelToKey()` on `readings.aqi_level`** — it already IS the key. `giosLabelToKey()` is only for values from `StationSummary.aqi.level_name` (the static JSON snapshot), which still uses Polish display strings like `"Dobry"`.

Use this pattern in every API route that reads `readings.aqi_level`:
```typescript
const levelKey: AqiLevelKey = (
  r.aqi_level === "brak_indeksu" || !r.aqi_level ? "no_data" : r.aqi_level
) as AqiLevelKey;
```

### 2b. `readings.pm25` from AQI snapshots are index scores, NOT µg/m³

Rows where `sensor_id IS NULL` (written by `harvest-aqi-snapshot.py`) store the GIOŚ AQI index value × 10 in `pm25/pm10/no2`. These are **not real concentration values**.

Real µg/m³ values only exist in rows where `sensor_id IS NOT NULL` (written by `harvest-readings.py`).

All concentration-based queries — charts, percentile bands, range bars, trend analysis — must filter:
```sql
WHERE sensor_id IS NOT NULL AND pm25 IS NOT NULL
```

Never mix index scores with concentration values. Passing an index score of `3.0` to `pm25ToLevelKey()` returns `"bardzo_dobry"` — technically valid but semantically wrong.

Add this comment to `src/lib/localDb.ts` before `getHourlyReadings()` and `getDailyReadings()`:
```typescript
// NOTE: Only rows with sensor_id IS NOT NULL contain real µg/m³ values.
// Rows from AQI snapshots (sensor_id IS NULL) store index scores, not concentrations.
// All functions here filter to sensor_id IS NOT NULL automatically.
```

### 2c. Current data coverage

As of the last harvest run:
- **289 stations** with metadata
- **1742 sensors** catalogued
- **1387 readings total** — Kraków has ~827, all other cities have ~10–20 each
- **Readings date range:** approx 1 day (2026-03-17 to 2026-03-18)
- **56 sensors** have been harvested via `harvest-readings.py`

The p10/p90 annual range in `MetricCardRow` requires `allDailyValues.length >= 7`. With 1 day of data for most cities, this threshold will only be met for Kraków. `MetricCard` will render without the range bar for other cities — this is correct behaviour, do not lower the threshold.

For `TodayStory`: rules 1 and 3 (smog alert / high AQI) work correctly from `readings.aqi_level`. Rules 2 and 4 require historical comparison data and will fall through to rule 5 (the count-based fallback) until more harvest runs complete. This is acceptable.

---

## 3. MAP WIRING — `PolandMap` has no `onStationClick` prop yet

Step F1.2 adds `onStationClick` to `PolandMap` and `MapWrapper`. Currently:
- `PolandMap` props: `{ stations: StationSummary[], focusStationId?: string }` — no click callback
- Markers use `marker.bindPopup(...)` — they show a Leaflet popup, not a panel

Step F1.2 must make these exact changes:

1. Add `onStationClick?: (stationId: string) => void` to `PolandMap` props
2. Replace `marker.bindPopup(...)` with `marker.on("click", () => onStationClick?.(station.id))`
3. Remove the `bindPopup` call entirely — `StationCard` in the panel replaces it
4. Add `onStationClick?: (stationId: string) => void` to `MapWrapper` props and pass through to `PolandMap`
5. In `PageShell`, pass `onStationClick` to `MapWrapper` which updates the URL via `window.history.pushState`

For `PageShell` to react to URL changes triggered by `pushState` (not `router.push`), it must read the station param via `useSearchParams()` from `next/navigation`. This requires a `<Suspense>` boundary around `PageShell` in `page.tsx`. Check whether one exists before adding `useSearchParams` — if not, wrap `<PageShell>` in `<Suspense fallback={null}>` in `page.tsx`.

BUG-2 reminder: if any tooltip or overlay is added back to the map in this step, it must use `zIndex ≥ 2000`.

---

## 4. `CityPanel` already has `CitySummaryCard` (BUG-5)

`CitySummaryCard` exists as an internal component inside `CityPanel.tsx` (added as the BUG-5 fix). Do not recreate it or replace it.

After F7.1, the city panel render order must be:
1. Panel header (city name, back link) — existing
2. `<DayPulseStrip>` — new in F7.1
3. `<DataFreshnessBanner>` — new in F0.2
4. `<AqiDashboardCard>` for Kraków / `<CitySummaryCard>` for other cities — existing
5. Station list — existing

---

## 5. `localDb.ts` may not exist yet

`src/lib/localDb.ts` is specified in `docs/local-data-collection-plan.md` Step H5.1. If this file does not exist, the agent must create it before executing any feature step that imports from it (F1.3, F2.2, F4.1, F7.1, F5.3).

Check first:
```bash
ls src/lib/localDb.ts 2>/dev/null && echo "EXISTS" || echo "MISSING — create from local-data-collection-plan.md H5.1"
```

---

## 6. `better-sqlite3` may not be installed

Check before any step that imports `better-sqlite3`:
```bash
node -e "require('better-sqlite3')" 2>&1 | head -1
# If error: npm install --save-exact better-sqlite3@9.4.3 @types/better-sqlite3@7.6.8
```

---

## 7. The national summary strip to remove in F0.1

In `PageShell.tsx`, the national summary strip is the `{national && (...)}` block that renders three cards for `national.worst`, `national.median`, `national.best`. Remove this entire block and replace it with `<TodayStory lang={lang} />`.

After removing the strip, also remove the `NationalSummary` type from `PageShell` props and remove the `national` prop from wherever `page.tsx` passes it — it will no longer be needed.

---

## 8. Zip delivery format reminder

When delivering changed files, build zips from the project root:
```bash
cd /path/to/project && zip -r output.zip src/path/to/file docs/path/to/file
```
Verify with `unzip -l output.zip` — all paths must start with `src/`, `docs/`, `data/`, or another project-root-relative prefix. Never zip a staging directory. (See BUG-4 in BUGS.md.)
