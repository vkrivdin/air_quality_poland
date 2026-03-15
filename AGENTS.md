# AGENTS.md

Air quality web app for Poland (Next.js 16, TypeScript, Supabase, Leaflet, Recharts, D3).

## Start here

Before writing any code, read these files in this order:

1. `docs/build-plan.md` — find the first incomplete step, execute it
2. `docs/file-tree.md` — verify your output matches the expected structure
3. `src/lib/aqi-config.ts` — every value you need is here (or `docs/aqi-config.ts` if not yet copied)
4. `docs/ui-component-reference.md` — exact TypeScript interfaces for every component
5. `BUGS.md` — read all principles before writing any code

## Non-negotiable rules

- All AQI colours, thresholds, copy strings, and benchmark numbers come from `src/lib/aqi-config.ts` — never hardcode them
- New components (Phase 2+) use inline styles, not Tailwind classes
- TypeScript strict mode — no `any`
- `"use client"` on any component using browser APIs or stateful hooks
- Polish identity colours (`#D4213D`, `#E9E8E7`) only in: `Navbar`, `PolishFlagIcon`, `SourceBadge`, `LanguageSwitcher`
- Never modify protected files — see `docs/file-tree.md` for the full list

## Commands

```bash
npm run dev          # local dev server
npx tsc --noEmit     # type check — must pass before every commit
npm run build        # production build
npm run lint         # ESLint
```

## How to execute a build step

Each step in `docs/build-plan.md` specifies: READS / PRODUCES / INSTRUCTIONS / CONSTRAINTS / VERIFY / COMMIT.
Follow that structure exactly. One commit per step. Use the exact commit message string from the step.

## If something is ambiguous

Check `docs/ui-component-reference.md` for component interfaces.
Check `docs/file-tree.md` for correct file paths.
Check `src/lib/aqi-config.ts` for any value that might come from config.
Do not guess — stop and ask.

## When you find or fix a bug

1. Fix the code first
2. Add an entry to `BUGS.md` following the format in `HOW-TO-LOG-BUGS.md`
3. If the principle has appeared before or cannot be machine-enforced, add it to the "Hard-won rules" section below
4. Commit the fix, the BUGS.md entry, and any AGENTS.md update together

## Hard-won rules

Principles promoted from BUGS.md after proving their worth. Each starts with the BUG-N reference.

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
