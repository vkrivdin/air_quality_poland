# Powietrze — Visual Identity & Layout Architecture
**Version:** 1.0 | **Status:** Approved | **Last updated:** March 2026

This document defines the visual identity system (Polish national identity expression, colour strategy, source badges) and the single-page layout architecture that replaces the current separate `/krakow` route.

---

## 1. The Core Tension: National Identity vs AQI Colour System

The AQI danger colour and the Polish flag red are both red. This is the central visual design challenge.

**The rule:** Polish national identity is expressed through *chrome* (nav, logo, source badges, accents). The AQI colour scale owns the *content* (cards, markers, charts, banners). These two colour uses must never overlap or compete.

A user who sees a red banner must immediately know whether it is a Polish identity element or a smog alert. There must be zero ambiguity.

---

## 2. Polish Flag Colours — Statutory Values

The statutory sRGB hex values for the Polish flag (per Polish law, Coat of Arms Act) are:

| Colour | Statutory hex | Use in Powietrze |
|---|---|---|
| Polish white | `#E9E8E7` | Background for flag icon elements |
| Polish red | `#D4213D` | Nav accent, logo, language toggle, source badge flags |
| Polish red (hover/dark) | `#B01C34` | Hover states on red elements |
| Polish red (tint) | `#F5D0D6` | Very light background tint for Polish-identity sections only |

**Rule:** `#D4213D` is the only red permitted for identity elements. Do not use `#FF0000`, `#CC0000`, or any approximation. The statutory colour is recognisable to Poles and carries legal and cultural weight.

---

## 3. Where Polish Identity Appears

### 3.1 Navigation bar

- Background: white (`var(--color-background-primary)`)
- **Bottom border: 3px solid `#D4213D`** — this is the primary identity signal in the chrome
- This mirrors the flag's horizontal structure: white (top) over red (bottom)
- No other borders on the nav bar

### 3.2 Logo / wordmark

- Text: "Powietrze" in neutral `var(--color-text-primary)`
- The letter **"P" is rendered in `#D4213D`** — a single accent letter
- Alternatively, an inline Polish flag icon (20×14px, white over red, `border-radius: 2px`) sits left of the wordmark
- Do not use a full red logo background or full red wordmark
- The flag icon approach is preferred: it is unambiguous and requires no typographic tricks

### 3.3 Language switcher (PL / EN)

- Active language tab: background `#D4213D`, text `#ffffff`
- Inactive tab: outline style, `var(--color-text-secondary)` text
- This is the one place flag red is used as a fill — it makes immediate sense as a nationality/language selector

### 3.4 Source attribution badges

See section 5. Polish flag appears on GIOŚ and Airly badges. EU badge uses EU blue (`#003399`) with gold star (`#FFD700`). WHO badge uses WHO blue (`#009EDB`).

### 3.5 Everything else

All cards, content areas, charts, the map, the activity matrix, body text — **fully neutral**. White or `var(--color-background-secondary)`. No red anywhere in content areas except the AQI colour system.

---

## 4. What is Deliberately Not Polish-branded

The following must remain neutral. Applying national colours to them would either conflict with the AQI system or look tacky:

- AQI level badge colours (owned by the AQI system)
- Warning banners (owned by the AQI system — red means danger, not Poland)
- Chart lines and fills (owned by the AQI system)
- Map markers (owned by the AQI system)
- Action buttons (neutral, no flag red)
- Any element that already carries semantic meaning in the AQI colour scale

---

## 5. Source Attribution Badges

Source badges appear in three locations:
1. **Footer** — all sources, full row
2. **Compliance modal** — inline with each benchmark bar (contextual attribution)
3. **Dashboard card meta row** — compact "Dane: GIOŚ + Airly" with small flag

### Badge design

Each badge: `border: 0.5px solid var(--color-border-tertiary)`, `border-radius: 8px`, `padding: 6px 12px`, horizontal flex layout.

| Source | Icon | Name | Description |
|---|---|---|---|
| GIOŚ | Polish flag (20×14px) | GIOŚ | Oficjalne dane rządowe |
| Airly | Polish flag (20×14px) | Airly | Krakowska sieć czujników |
| EU Directive | EU flag (20×14px, `#003399` + gold star) | Dyrektywa UE 2024/2881 | Normy na 2030 r. |
| WHO | WHO blue block (20×14px, `#009EDB`, "WHO" text) | WHO AQG 2021 | Wytyczne zdrowotne |

### Polish flag icon (mini, reusable component)

```tsx
// PolishFlagIcon.tsx — 20×14px default size
<div style={{
  width: 20, height: 14,
  borderRadius: 2,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  border: '0.5px solid rgba(0,0,0,0.08)',
  flexShrink: 0,
}}>
  <div style={{ flex: 1, background: '#E9E8E7' }} />
  <div style={{ flex: 1, background: '#D4213D' }} />
</div>
```

**Rule:** The Polish flag icon appears on GIOŚ and Airly because they are Polish organisations. It signals "this data is from Poland, for Poland" without any text. Polish users will recognise it immediately.

---

## 6. Design Sensibility for Polish Users

Research findings that should inform visual decisions:

- Polish consumers place high value on aesthetics — how a product looks can be as important as how it functions. Design quality is not optional.
- There is a growing preference for domestic brands, provided they match the quality of their foreign counterparts. Local brands have an edge in authenticity and cultural relevance. Powietrze's Polish identity is a genuine advantage — make it visible without being crude.
- Bold, contrasting colours and decisive typography resonate broadly with Polish audiences. Avoid soft pastels or indeterminate neutrals for primary communication.
- The leading Kraków design studio (The Rectangles) is specifically known for data-driven design with simplicity and clarity — that is the exact aesthetic target for Powietrze.

**Practical implications:**
- Typography: Inter or system sans-serif, weight 400/500 only. No thin weights that read as unsure.
- Headline copy: imperative, direct, no hedging. (Already defined in `aqi-config-spec.md`.)
- Whitespace: generous, not cramped. Polish design sensibility rewards breathing room.
- Data density: show the number prominently. Poles are tech-savvy and want the data, not just the verdict.

---

## 7. Single-Page Layout Architecture

### The decision

The current separate `/krakow` route is replaced by a **focus state pattern** on a single-page layout. There are no city-specific routes.

**Why:**
- Navigation between pages creates friction for what is fundamentally a zoom action
- Multiple city routes don't scale (Warsaw, Gdańsk, Wrocław would each need their own page)
- The map and the detail view should be visible simultaneously on desktop
- Mobile users should not experience full page reloads to view city detail

### URL strategy

| State | URL | Behaviour |
|---|---|---|
| Default (Poland overview) | `/` | Full Poland map, national summary |
| City focused | `/?city=krakow` | Detail panel open for Kraków |
| Station focused | `/?station=gios_401` | Detail panel open for specific station |

URL updates use `router.push('/?city=krakow', undefined, { shallow: true })` — no page reload, history entry created, back button works, link is shareable.

On initial load: if URL contains `city` or `station` param, open focus panel immediately. This makes every city/station view a shareable deep link.

### Content layers

**Always visible (default state):**
- Poland map with all GIOŚ stations, colour-coded by current AQI level
- National summary strip: worst / average / best city today (3 metric cards)
- Navigation bar

**Focus state — city selected (e.g. `?city=krakow`):**
- All of the above, plus:
- AQI dashboard card (full: headline + activity matrix + compliance badge)
- Pollutant stats row (PM2.5, PM10, NO₂)
- Seasonal calendar (D3 heatmap)
- Historical chart (24h default, pollutant selector)
- Contextual / seasonal copy
- Station selector if multiple stations in the city

**Focus state — station selected (e.g. `?station=gios_401`):**
- All of city focus, plus:
- Station-specific metadata (exact coordinates, sensor type, last reading timestamp)
- Station-level pollutant breakdown
- Note: most users will not drill to station level — city focus is the primary experience

### Desktop layout

```
┌─────────────────────────────────────────────────────────────┐
│ Nav bar                                                       │
├───────────────────────────────┬─────────────────────────────┤
│                               │                             │
│   Poland map (60% width)      │  Focus panel (40% width)    │
│   Always visible              │  Appears on city/station    │
│   Markers update on focus     │  click. Scrollable.         │
│                               │                             │
│                               │  [AQI card]                 │
│                               │  [Activity matrix]          │
│                               │  [Seasonal calendar]        │
│                               │  [Historical chart]         │
│                               │                             │
└───────────────────────────────┴─────────────────────────────┘
│ Footer (source badges, disclaimer)                           │
└─────────────────────────────────────────────────────────────┘
```

### Mobile layout

```
┌─────────────────────────┐
│ Nav bar                  │
├─────────────────────────┤
│ Map (40vh, fixed)        │
│ Tap a city to focus      │
├─────────────────────────┤
│ Focus panel (scrollable) │  ← slides up on city tap
│ [AQI card]               │
│ [Activity matrix]        │
│ [Seasonal calendar]      │     horizontally scrollable
│ [Historical chart]       │
└─────────────────────────┘
│ Footer                   │
└─────────────────────────┘
```

The map stays at the top on mobile — users can see the map while scrolling the detail panel. The map is not hidden or replaced.

### Transition behaviour

- City/station tap: URL updates, focus panel animates in (slide up on mobile, fade in on desktop). No full page reload.
- Back button or clicking the map background (empty area): focus panel closes, URL returns to `/`.
- Clicking a different city while one is focused: focus panel updates in place, URL updates.

### Migration from current `/krakow` route

The current `src/app/krakow/` directory and its components should be migrated in Phase 3, Step 4.1 of the build plan. The Kraków data and components are not deleted — they are moved into the focus panel system. The `/krakow` route should redirect to `/?city=krakow` via `next.config.ts` redirects until migration is complete.

---

## 8. App Identity Token Summary

These are the design tokens specific to Powietrze's identity layer. They go in `src/styles/tokens.css` or as Tailwind config values.

```css
/* Polish identity tokens — use ONLY for chrome elements, never for AQI content */
--color-polish-red: #D4213D;
--color-polish-red-hover: #B01C34;
--color-polish-red-tint: #F5D0D6;
--color-polish-white: #E9E8E7;

/* Nav */
--nav-border-bottom: 3px solid #D4213D;
--nav-bg: var(--color-background-primary);

/* Source badge flag dimensions */
--flag-icon-width: 20px;
--flag-icon-height: 14px;
```

**Rule:** These tokens may only be imported and used in: `Navbar.tsx`, `PolishFlagIcon.tsx`, `SourceBadge.tsx`, `LanguageSwitcher.tsx`. Any other component importing `--color-polish-red` is a code review failure.
