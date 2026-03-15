# TESTING.md — Powietrze testing guide
**Version:** 1.0 | **Last updated:** March 2026

This document defines the testing strategy for the Powietrze demo. It covers:
- What to test and when
- Manual smoke test checklist (run before every commit)
- Visual regression checklist (run before every delivery)
- Known data limitations that affect what can be tested
- Rules for agents writing or reviewing code

---

## 1. Philosophy

This is a demo app backed by static local JSON data. There is no live API, no database, no auth.
The primary failure modes are:

1. **Visual regressions** — layout breaks, z-index conflicts, panels not rendering
2. **Data mapping bugs** — wrong AQI level derived from GIOŚ label, null values not guarded
3. **Routing bugs** — city slug normalisation, searchParams not forwarded
4. **Inconsistent city experience** — behaviour differs between Kraków and other cities without clear reason

Testing must be fast enough to run on every delivery. The bar is: open browser, load three URLs, check the checklist. Total time: under 2 minutes.

---

## 2. Data limitations (read before testing)

| Limitation | Effect on tests |
|---|---|
| `krakow-readings.json` has ~20 hourly entries (~1 day) | `SeasonalCalendar` and `PollutantChart` show placeholder/fallback for Kraków |
| Non-Kraków stations have `aqi.level_name` but all `pm25_level`, `pm10_level`, `no2_level` are `null` | Non-Kraków city panel cannot show pollutant values — only level badge and station count |
| `stations-summary.json` is a static snapshot (289 stations) | AQI levels and counts are frozen at snapshot time — do not test live accuracy |
| `WarningBanner` only appears for `zly` / `bardzo_zly` | Current demo data is all `dobry`/`bardzo_dobry` → banner will never show in normal testing; test manually by temporarily forcing `levelKey` |

---

## 3. Test URLs

Always test these three URLs in order. They cover the three distinct rendering paths.

| # | URL | What it tests |
|---|---|---|
| T-1 | `http://localhost:3000/` | National map — full Poland view, all 289 stations, no city panel |
| T-2 | `http://localhost:3000/?city=krakow` | Kraków path — AqiDashboardCard, activity matrix, pollutant stats, compliance badge |
| T-3 | `http://localhost:3000/?city=warszawa` | Generic city path — city summary card, station list, no Kraków-specific components |

If `/krakow` also works (redirect is active), test that too and verify it lands on `/?city=krakow`.

---

## 4. Smoke test checklist

Run this before every delivery zip is packaged. Check every item for all three URLs.

### T-1 — National map (`/`)

- [ ] Map tiles render (roads, labels, colour regions visible)
- [ ] Station markers visible — coloured dots across Poland
- [ ] AQI legend visible top-left — all 6 levels listed with counts
- [ ] Counts in legend sum to 289 (total station count)
- [ ] National summary strip visible below Navbar — Najgorsze / Mediana / Najlepsze
- [ ] GIOŚ source badge visible bottom-right of map
- [ ] Footer visible at bottom — 4 source badges + disclaimer text
- [ ] No city panel visible on the right
- [ ] Language switcher: clicking EN changes all Polish UI strings to English; PL restores them
- [ ] Navbar logo click navigates to `/` (no city)

### T-2 — Kraków (`/?city=krakow`)

- [ ] Map zooms to Kraków (fitBounds — all 9 stations visible)
- [ ] City panel opens on the right — "Kraków · 9 stacji"
- [ ] "← Mapa Polski" link navigates back to `/`
- [ ] AqiDashboardCard renders above station list
- [ ] AqiDashboardCard header band has AQI colour (not white)
- [ ] PM2.5, PM10, NO₂ values shown (even if `—` for missing data)
- [ ] Activity matrix renders — 5 activity icons in a row
- [ ] "Pozostałe stacje" section header visible
- [ ] Station list renders remaining 8 stations with AQI badges
- [ ] ComplianceBadge ("3× powyżej normy UE 2030") visible in card footer
- [ ] ComplianceBadge click opens ComplianceModal
- [ ] ComplianceModal closes on: ×, backdrop click, Escape key
- [ ] ComplianceModal z-index: modal appears fully above map tiles (no bleed-through)
- [ ] Footer visible at bottom of panel scroll

### T-3 — Warszawa (`/?city=warszawa`)

- [ ] Map zooms to Warszawa (fitBounds — all stations visible)
- [ ] City panel opens — "Warszawa · N stacji" with correct count
- [ ] **City summary card renders** — level badge, station count breakdown (see §5)
- [ ] City summary card uses same visual weight as Kraków's AqiDashboardCard (same border, same padding rhythm)
- [ ] Station list renders all stations with AQI badges
- [ ] "Brak danych cząstkowych" shown for stations with null pollutant levels
- [ ] No AqiDashboardCard, no ActivityMatrix, no ComplianceBadge (Kraków-only components)
- [ ] Footer visible

### Cross-cut checks (all URLs)

- [ ] `tsc --noEmit` exits 0 before packaging
- [ ] No `console.error` or `console.warn` in browser devtools
- [ ] No visible layout overflow (no horizontal scrollbar at 1280px width)
- [ ] Switching PL ↔ EN: all visible strings change language; no mixed-language UI

---

## 5. City summary card spec (non-Kraków)

Non-Kraków cities lack hourly readings. Their summary card must work from `StationSummary[]` alone.

**Required elements:**
- Dominant level badge — the most common non-null AQI level among the city's stations
- Station count breakdown — e.g. "7 Dobry · 2 Brak danych"
- Best station name — the station with the lowest `score`
- Worst station name — the station with the highest `score`
- Data source note — "Dane: GIOŚ" with `calc_date` of the most recent station

**Must NOT include:**
- PM2.5 / PM10 / NO₂ values (all null for non-Kraków stations in demo data)
- ActivityMatrix (requires a single resolved `levelKey` with full config)
- ComplianceBadge (Kraków-specific context)
- SeasonalCalendar / PollutantChart (no hourly readings)

---

## 6. Visual regression checks

Run these after any change to `PageShell.tsx`, `CityPanel.tsx`, `Navbar.tsx`, or `globals.css`.

- [ ] At 1280px viewport: map column and city panel each fill their half without overflow
- [ ] At 375px viewport (mobile): layout degrades gracefully — no overlapping panels
- [ ] Footer text does not overflow its container at any viewport width
- [ ] Navbar height is exactly 52px — does not grow with long city names
- [ ] AqiDashboardCard at `no_data` level: renders without crash, shows "Brak danych z czujników"
- [ ] WarningBanner (force `levelKey="zly"`): sticky at top of panel, dismiss button works, does not re-appear after dismiss in same session

---

## 7. Testing WarningBanner manually

The banner never shows in demo data (all levels are good). To test it:

1. In `CityPanel.tsx`, temporarily change the `levelKey` prop passed to `WarningBanner` to `"zly"` or `"bardzo_zly"`
2. Load `/?city=krakow`
3. Verify: banner appears sticky above the panel scroll, coloured background matches AQI level, dismiss button removes it
4. Reload page — banner reappears (sessionStorage key is cleared on tab close, not reload)
5. Dismiss — navigate away — return — banner should still be gone (sessionStorage persists across navigation within the same tab session)
6. Revert the temporary change before committing

---

## 8. What agents must check before delivering

Every agent producing a delivery zip must verify:

```bash
# 1. Type check — must be exit code 0
npx tsc --noEmit

# 2. Zip contents — every path must start with src/, docs/, or a project-root prefix
unzip -l <delivery>.zip

# 3. Tile URL — if PolandMap.tsx was modified
curl -s -o /dev/null -w "%{http_code}" \
  "https://basemaps.cartocdn.com/rastertiles/voyager/10/571/341.png"
# Expected: 200

# 4. No console errors — load T-1, T-2, T-3 and check browser devtools
```

---

## 9. Adding new tests

When a bug is found that passes the current checklist:

1. Fix the bug
2. Add a specific checkbox to the relevant section of this document that would have caught it
3. Add a `BUGS.md` entry
4. Commit all three together (fix + TESTING.md update + BUGS.md entry)

This keeps the checklist honest — it only contains checks that have earned their place by catching a real bug.
