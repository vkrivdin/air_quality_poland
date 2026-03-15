# Powietrze — UI Component Reference
**Version:** 2.0 | **For:** LLM agents | **Last updated:** March 2026

This document is a lookup reference. It does not contain rationale or explanations. For rationale, see `docs/ui-design-decisions-rationale.md`. Every agent building a component reads the relevant section here and `src/lib/aqi-config.ts`. No other source is authoritative.

---

## RULE: Source of truth hierarchy

1. `src/lib/aqi-config.ts` — all AQI values, thresholds, copy strings, benchmark numbers
2. This document — component interfaces, layout rules, exact pixel values
3. No other document overrides these two

---

## 1. Design tokens (hard values — not to be approximated)

### Spacing
```
base unit:        8px
card padding:     20px (desktop), 16px (mobile)
card gap:         12px
inner gap:        8px
```

### Border radius
```
cards:            12px  (border-radius: 12px)
inner elements:   8px
pill badges:      20px
flag icon:        2px
```

### Border width
```
card border:      0.5px
badge border:     0.5px
nav bottom:       3px   (Polish identity — this value is exact, do not change)
```

### Typography
```
AQI headline:     18–20px, weight 500
section headings: 16px, weight 500
body / labels:    13–14px, weight 400
sub-labels:       11–12px, weight 400
minimum:          11px (never below this)
font:             Inter (loaded via next/font) or system sans-serif
weights used:     400, 500 only — never 600, 700, 300
```

### Polish identity colours (use ONLY in Navbar, PolishFlagIcon, SourceBadge, LanguageSwitcher)
```
--color-polish-red:       #D4213D   (statutory Polish flag red — exact, no approximation)
--color-polish-red-hover: #B01C34
--color-polish-red-tint:  #F5D0D6
--color-polish-white:     #E9E8E7   (statutory Polish flag white)
```

### Activity state colours (fixed — do not vary with AQI level)
```
safe:    bg #EAF3DE, text #27500A, icon ✓
caution: bg #FAEEDA, text #633806, icon ~
avoid:   bg #FCEBEB, text #791F1F, icon ✗
```

### AQI level colours (from aqi-config.ts — do not hardcode, always import)
See `src/lib/aqi-config.ts` → `AQI_LEVEL_CONFIGS[key].color.*`
Fields: `.primary`, `.bg`, `.border`, `.text`

---

## 2. Component interfaces (exact TypeScript)

### `AqiBadge`
```tsx
// File: src/app/components/AqiBadge.tsx
type Props = {
  levelKey: AqiLevelKey | null | undefined;
  showEnglish?: boolean;   // default false
  size?: "sm" | "md" | "lg";  // default "md"
};
```
Styling: inline styles only. No Tailwind.

---

### `PolishFlagIcon`
```tsx
// File: src/app/components/PolishFlagIcon.tsx
type Props = {
  width?: number;   // default 20
  height?: number;  // default 14
};
```
Top stripe: `#E9E8E7`. Bottom stripe: `#D4213D`. `border-radius: 2px`. No Tailwind.

---

### `LanguageSwitcher` + `useLang`
```tsx
// File: src/app/components/LanguageSwitcher.tsx
export type Lang = "pl" | "en";

// Hook — use in page-level components
export function useLang(): [Lang, (l: Lang) => void];
// Reads/writes localStorage key: "powietrze_lang". Default: "pl".

// Component
type Props = { lang: Lang; onChange: (l: Lang) => void; };
export default function LanguageSwitcher(props: Props): JSX.Element;
```
Active state: `background: "#D4213D"` (hardcoded hex, not CSS variable — SSR safety).

---

### `SourceBadge`
```tsx
// File: src/app/components/SourceBadge.tsx
export type SourceKey = "gios" | "airly" | "eu_directive" | "who";
type Props = { source: SourceKey; lang?: "pl" | "en"; };  // lang default "pl"
```

Source content (exact strings):
| key | icon | name | desc_pl | desc_en |
|---|---|---|---|---|
| `gios` | PolishFlagIcon | GIOŚ | Oficjalne dane rządowe | Official government data |
| `airly` | PolishFlagIcon | Airly | Krakowska sieć czujników | Kraków sensor network |
| `eu_directive` | EU blue `#003399` + `#FFD700` star | Dyrektywa UE 2024/2881 | Normy na 2030 r. | 2030 targets |
| `who` | WHO blue `#009EDB` + "WHO" text | WHO AQG 2021 | Wytyczne zdrowotne | Health guidelines |

---

### `Navbar`
```tsx
// File: src/app/components/Navbar.tsx
type Props = {
  lang: Lang;
  onLangChange: (l: Lang) => void;
  cityLabel?: string;   // shown as "· Kraków" after logo when present
};
```
Structure: `header` element, height 52px. Left: PolishFlagIcon(24×16) + "Powietrze" wordmark ("P" in `#D4213D`). Right: LanguageSwitcher.
`border-bottom: "3px solid #D4213D"` — exact, always.
`background: "var(--color-background-primary)"` — always white, never changes with AQI level.

---

### `ActivityMatrix`
```tsx
// File: src/app/components/ActivityMatrix.tsx
type Props = {
  levelKey: Exclude<AqiLevelKey, "no_data">;  // "no_data" is excluded
  lang: "pl" | "en";
};
```
Renders 5 cells in order of `ACTIVITY_DISPLAY_ORDER` from `aqi-config.ts`.
Each cell: 28px circle (state colour) + activity label (10px) + optional note (10px).
Grid: `grid-template-columns: repeat(5, 1fr)`.

---

### `ComplianceBadge`
```tsx
// File: src/app/components/ComplianceBadge.tsx
type Props = { lang: Lang; };
```
Badge text from `getComplianceBadge()` (no arguments). Opens `ComplianceModal` on click.
Severity colours:
```
green: bg #EAF3DE, border #3B6D11, text #27500A
amber: bg #FAEEDA, border #854F0B, text #633806
red:   bg #FCEBEB, border #A32D2D, text #791F1F
```

---

### `ComplianceModal`
```tsx
// File: src/app/components/ComplianceModal.tsx
type Props = {
  isOpen: boolean;
  onClose: () => void;
  lang: Lang;
};
```
Closes on: Escape key, backdrop click, × button. All three are required.
Max-width: 440px. Max-height: 82vh, scrollable.
All BENCHMARKS values from `src/lib/aqi-config.ts` — none hardcoded.
Bar width formula: `Math.round((row.value / BENCHMARKS.krakow_annual_pm25) * 100)%`

---

### `AqiDashboardCard`
```tsx
// File: src/app/components/AqiDashboardCard.tsx
type Props = {
  levelKey: AqiLevelKey;
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  stationName: string;
  updatedAt: string;        // ISO datetime string
  lang: Lang;
  percentile?: number | null;       // null if dataPointCount < GOOD_DAY_MIN_DAYS
  dataPointCount?: number;          // default 0
};
```
Card border colour: `getLevelConfig(levelKey).color.border`.
Header band background: `getLevelConfig(levelKey).color.bg`.
`ActivityMatrix` is NOT rendered when `levelKey === "no_data"`.
`ComplianceBadge` IS rendered in all states including `no_data`.
Percentile line only renders when: `percentile !== null AND dataPointCount >= GOOD_DAY_MIN_DAYS AND levelKey in GOOD_DAY_LEVELS`.

---

### `SeasonalCalendar`
```tsx
// File: src/app/components/SeasonalCalendar.tsx
type DayReading = { date: string; avgPm25: number | null; }; // date format: "YYYY-MM-DD"
type Props = { readings: DayReading[]; lang: "pl" | "en"; };
```
Guard: if `readings.length < 7`, render placeholder text only — no grid.
Library: D3.js (import as `import * as d3 from "d3"`).
Cell size: 11×11px desktop, 9×9px mobile.
No-data colour: `#D3D1C7`.
Cell colour: `getLevelConfig(pm25ToLevelKey(day.avgPm25)).color.primary`.
Mobile: container has `overflowX: "auto"`.
Must be `"use client"`.

---

### `PollutantChart`
```tsx
// File: src/app/components/PollutantChart.tsx
type DataPoint = { date: string; value: number; };
type Props = {
  data: DataPoint[];
  pollutant: "pm25" | "pm10" | "no2" | "o3" | "so2";
  lang: "pl" | "en";
};
```
Library: Recharts. `ResponsiveContainer width="100%" height={240}`.
WHO reference line: only when `pollutant === "pm25"`. Value: `BENCHMARKS.who_24h_pm25` (imported).
Time range filter: `["24h", "7d", "30d", "90d"]`, default `"24h"`, applied client-side.
Chart line colour: `"#5F5E5A"` (neutral grey — never AQI level colours).
Must be `"use client"`.

---

### `WarningBanner`
```tsx
// File: src/app/components/WarningBanner.tsx
type Props = { levelKey: AqiLevelKey; lang: "pl" | "en"; };
```
Returns `null` for any `levelKey` that is not `"zly"` or `"bardzo_zly"`.
Dismissal: `sessionStorage` key `"powietrze_banner_dismissed_" + levelKey`.
Position: `sticky`, `top: 0`, `zIndex: 50`.
Background/border from `getLevelConfig(levelKey).color.bg` / `.border`.
Must be `"use client"`.

---

### `Footer`
```tsx
// File: src/app/components/Footer.tsx
type Props = { lang: "pl" | "en"; };
```
Renders: 4× SourceBadge (gios, airly, eu_directive, who) + `DISCLAIMER[lang]` + copyright.
Background: `var(--color-background-secondary)`.
Top border: `0.5px solid var(--color-border-tertiary)`.
`DISCLAIMER` imported from `src/lib/aqi-config.ts` — not hardcoded.

---

## 3. Page layout

### Homepage `src/app/page.tsx`

**Default state (no URL params):**
- Navbar (full width)
- National summary strip: 3 metric cards (worst / median / best PM2.5 city today)
- Poland map (full remaining height)
- Footer

**Focus state `?city=krakow`:**
Desktop (≥1024px):
```
Navbar
[Map 60% | Focus panel 40%]
Footer
```
Map stays visible. Focus panel is scrollable. No page reload on focus change.

Mobile (<1024px):
```
Navbar
Map (height: 40vh, fixed)
Focus panel (scrolls below map)
Footer
```

**URL management:**
- City focus: `router.push("/?city=" + slug, undefined, { shallow: true })`
- Clear focus: `router.push("/", undefined, { shallow: true })`
- On initial load: if `searchParams.city` exists, render focus panel immediately

**Background:** `var(--color-background-tertiary)` — never `#0a0f1e` or any dark colour.

---

## 4. Constraints that apply to ALL components

1. No Tailwind classes in any component created after Phase 2. Use inline styles with CSS variables.
2. No `any` TypeScript type unless explicitly permitted in a build step.
3. No hardcoded AQI colour values — always import from `src/lib/aqi-config.ts`.
4. No hardcoded benchmark numbers — always import from `BENCHMARKS` in `src/lib/aqi-config.ts`.
5. No hardcoded copy strings related to AQI levels — always import from `aqi-config.ts`.
6. The four CSS variables `--color-polish-red`, `--color-polish-red-hover`, `--color-polish-red-tint`, `--color-polish-white` may only be used in: `Navbar.tsx`, `PolishFlagIcon.tsx`, `SourceBadge.tsx`, `LanguageSwitcher.tsx`.
7. All components that use browser APIs (`localStorage`, `sessionStorage`, event listeners) must be `"use client"`.
8. No component may import from another component's internal implementation — only from its exported types and default export.
