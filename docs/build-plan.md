# Powietrze — Build Plan
**Version:** 2.0 | **For:** LLM agents and human developers | **Last updated:** March 2026

---

## HOW TO READ THIS DOCUMENT

Each step has this structure:

```
### Step N.N — Name
READS:    files the agent must read before starting this step
PRODUCES: files the agent will create or modify
INSTRUCTIONS: numbered, imperative, complete
CONSTRAINTS: things the agent must NOT do
VERIFY: exact shell commands; expected output
COMMIT: exact commit message string
```

**Rules for agents executing this plan:**
1. Never start a step without reading every file listed under READS.
2. Never skip a step. Steps within a phase are strictly ordered.
3. If a VERIFY command produces unexpected output, stop and report — do not proceed.
4. Do not add functionality not listed in INSTRUCTIONS. No extra props, no extra files, no "improvements."
5. Every value (hex colour, threshold number, copy string) comes from `src/lib/aqi-config.ts` unless the step explicitly states otherwise.
6. TypeScript strict mode is always on. No `any` types unless a step explicitly permits one.

---

## PROJECT STATE AT START OF THIS PLAN

**Existing files that matter:**
- `src/lib/types.ts` — contains `AQI_LEVELS` (to be replaced), `StationSummary`, `KrakowStation` types
- `src/lib/gios.ts` — GIOŚ API fetcher (keep, do not modify unless a step says to)
- `src/lib/supabase.ts` — Supabase client (keep, do not modify unless a step says to)
- `src/lib/localData.ts` — local JSON data layer (keep unchanged through Phase 4)
- `src/app/components/AqiBadge.tsx` — exists, uses old colour system (will be rewritten in Step 2.3)
- `src/app/components/MapWrapper.tsx` — exists, keep unchanged until Phase 5
- `src/app/components/PolandMap.tsx` — exists, keep unchanged until Phase 5
- `src/app/page.tsx` — dark-theme home page (will be fully replaced in Phase 4b)
- `src/app/krakow/page.tsx` — dark-theme Kraków page (will be removed in Phase 4b)
- `src/app/layout.tsx` — root layout with Inter font (keep, minor update in Step 2b.3)
- `src/data/stations-summary.json` — local station snapshot (keep unchanged)
- `src/data/krakow-readings.json` — local readings snapshot (keep unchanged)
- `sql/001_init_schema.sql` — Supabase schema (one fix needed in Step 2.0)
- `docs/aqi-config-spec.md` — human-readable spec (reference only, do not modify)
- `docs/aqi-config.ts` — the config file to copy in Step 2.1

**Known issues to fix before building:**
- `readings.aqi_level` seed data uses English strings (`'moderate'`) — must be Polish display strings
- `types.ts` contains unused `Dostateczny` level
- No `recharts`, `d3`, or `@types/d3` in `package.json`

---

## PHASE 0 — Pre-build fixes

### Step 0.1 — Install missing packages

READS: `package.json`

PRODUCES: updated `package.json`, updated `package-lock.json`

INSTRUCTIONS:
1. Run: `npm install --save-exact recharts@2.12.7 d3@7.9.0 @types/d3@7.4.3`
2. Verify the three packages appear in `dependencies` / `devDependencies` in `package.json`

CONSTRAINTS:
- Do not install any other packages in this step
- Do not use `^` or `~` version prefixes — `--save-exact` enforces this

VERIFY:
```bash
node -e "const p = require('./package.json'); console.log(p.dependencies.recharts, p.dependencies.d3)"
# Expected output: 2.12.7  7.9.0
```

COMMIT: `chore: install recharts, d3, @types/d3 with exact versions`

---

### Step 0.2 — Fix aqi_level strings in seed SQL

READS: `sql/002_seed_krakow_demo.sql`

PRODUCES: modified `sql/002_seed_krakow_demo.sql`

INSTRUCTIONS:
1. In `sql/002_seed_krakow_demo.sql`, replace every English `aqi_level` value with the corresponding Polish display string:
   - `'very_good'` → `'Bardzo dobry'`
   - `'good'` → `'Dobry'`
   - `'moderate'` → `'Umiarkowany'`
   - `'bad'` → `'Zły'`
   - `'very_bad'` → `'Bardzo zły'`
2. The three existing INSERT rows use `'moderate'` and `'good'` — update them to `'Umiarkowany'` and `'Dobry'`

CONSTRAINTS:
- Do not change any column names, table names, or numeric values
- Do not change the schema file `001_init_schema.sql`

VERIFY:
```bash
grep "aqi_level" sql/002_seed_krakow_demo.sql
# Expected: all values are Polish strings, no English level names remain
grep -E "'good'|'moderate'|'bad'|'very_good'|'very_bad'" sql/002_seed_krakow_demo.sql
# Expected: no output (all replaced)
```

COMMIT: `fix: use Polish display strings for aqi_level in seed SQL`

---

## PHASE 2 — Config layer

### Step 2.1 — Create `src/lib/aqi-config.ts`

READS: `docs/aqi-config.ts`

PRODUCES: `src/lib/aqi-config.ts` (new file)

INSTRUCTIONS:
1. Copy the entire contents of `docs/aqi-config.ts` to `src/lib/aqi-config.ts` without modification

CONSTRAINTS:
- Do not edit any values, types, or comments during the copy
- Do not rename any exports

VERIFY:
```bash
npx tsc --noEmit
# Expected: exit code 0, no errors
diff docs/aqi-config.ts src/lib/aqi-config.ts
# Expected: no differences
```

COMMIT: `feat: add aqi-config.ts — single source of truth for levels, benchmarks, copy`

---

### Step 2.2 — Refactor `src/lib/types.ts`

READS: `src/lib/types.ts`, `src/lib/aqi-config.ts`

PRODUCES: modified `src/lib/types.ts`

INSTRUCTIONS:
1. Delete these exports from `types.ts`: `AqiLevel`, `AqiMeta`, `AQI_LEVELS`, `AQI_FALLBACK`, `getAqiMeta`
2. Add this re-export line at the top of `types.ts`:
   ```ts
   export type { AqiLevelKey, ActivityKey, ActivityState, AqiLevelConfig } from '@/lib/aqi-config';
   export { getLevelConfig, giosLabelToKey, pm25ToLevelKey } from '@/lib/aqi-config';
   ```
3. Keep `StationSummary`, `KrakowStation`, `PollutantReading` types unchanged
4. In `StationSummary`, change the `aqi.level_name` field type from `AqiLevel` to `string | null`

CONSTRAINTS:
- Do not modify `StationSummary` or `KrakowStation` field names or structure
- Do not add any new types in this step

VERIFY:
```bash
npx tsc --noEmit
# Expected: exit code 0
grep -r "Dostateczny" src/
# Expected: no output
grep -r "AQI_LEVELS" src/
# Expected: no output
grep -r "getAqiMeta" src/
# Expected: no output
```

COMMIT: `refactor: remove AQI_LEVELS from types.ts, re-export from aqi-config`

---

### Step 2.3 — Rewrite `src/app/components/AqiBadge.tsx`

READS: `src/lib/aqi-config.ts`, `src/app/components/AqiBadge.tsx`

PRODUCES: modified `src/app/components/AqiBadge.tsx`

INSTRUCTIONS:
1. Replace the entire file with the following implementation:

```tsx
"use client";
import { getLevelConfig, AQI_NO_DATA_CONFIG } from "@/lib/aqi-config";
import type { AqiLevelKey } from "@/lib/aqi-config";

type Props = {
  levelKey: AqiLevelKey | null | undefined;
  showEnglish?: boolean;
  size?: "sm" | "md" | "lg";
};

const SIZE_STYLES = {
  sm: { padding: "2px 8px",  fontSize: 11 },
  md: { padding: "4px 12px", fontSize: 12 },
  lg: { padding: "6px 14px", fontSize: 14 },
};

export default function AqiBadge({ levelKey, showEnglish = false, size = "md" }: Props) {
  const cfg = levelKey ? getLevelConfig(levelKey) : AQI_NO_DATA_CONFIG;
  const sz  = SIZE_STYLES[size];

  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      borderRadius: 20,
      fontWeight: 500,
      border: `0.5px solid ${cfg.color.border}`,
      background: cfg.color.bg,
      color: cfg.color.text,
      padding: sz.padding,
      fontSize: sz.fontSize,
    }}>
      <span style={{
        width: 8, height: 8,
        borderRadius: "50%",
        background: cfg.color.primary,
        flexShrink: 0,
      }} />
      {cfg.label_pl}
      {showEnglish && (
        <span style={{ opacity: 0.65, fontWeight: 400, fontSize: sz.fontSize - 1 }}>
          ({cfg.label_en})
        </span>
      )}
    </span>
  );
}
```

CONSTRAINTS:
- Do not use any Tailwind classes in this component — inline styles only
- Do not import from `src/lib/types.ts`
- Do not add additional props beyond those in the type definition above

VERIFY:
```bash
npx tsc --noEmit
# Expected: exit code 0
```

COMMIT: `feat: rewrite AqiBadge using aqi-config colour system, inline styles only`

---

## PHASE 2b — Visual identity components

### Step 2b.1 — Add identity tokens to `src/app/globals.css`

READS: `src/app/globals.css`

PRODUCES: modified `src/app/globals.css`

INSTRUCTIONS:
1. Add the following block inside the existing `:root {}` block (or create one if absent):
```css
/* Polish identity tokens — use ONLY in: Navbar, PolishFlagIcon, SourceBadge, LanguageSwitcher */
--color-polish-red: #D4213D;
--color-polish-red-hover: #B01C34;
--color-polish-red-tint: #F5D0D6;
--color-polish-white: #E9E8E7;
```

CONSTRAINTS:
- Do not remove any existing CSS
- Do not use these tokens in any component other than the four listed in the comment

VERIFY:
```bash
grep "color-polish-red" src/app/globals.css
# Expected: 4 lines (the four token definitions)
```

COMMIT: `chore: add Polish identity CSS tokens to globals.css`

---

### Step 2b.2 — Create `src/app/components/PolishFlagIcon.tsx`

READS: `src/app/globals.css` (to confirm tokens exist)

PRODUCES: `src/app/components/PolishFlagIcon.tsx` (new file)

INSTRUCTIONS:
1. Create the file with the following exact implementation:

```tsx
type Props = {
  width?: number;
  height?: number;
};

export default function PolishFlagIcon({ width = 20, height = 14 }: Props) {
  return (
    <div style={{
      width,
      height,
      borderRadius: 2,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      border: "0.5px solid rgba(0,0,0,0.08)",
      flexShrink: 0,
    }}>
      <div style={{ flex: 1, background: "#E9E8E7" }} />
      <div style={{ flex: 1, background: "#D4213D" }} />
    </div>
  );
}
```

CONSTRAINTS:
- No props other than `width` and `height`
- No Tailwind classes
- Colours must be exact statutory values: `#E9E8E7` (white) and `#D4213D` (red)

VERIFY:
```bash
npx tsc --noEmit
# Expected: exit code 0
```

COMMIT: `feat: add PolishFlagIcon component with statutory colours`

---

### Step 2b.3 — Create `src/app/components/LanguageSwitcher.tsx`

READS: `src/app/globals.css`

PRODUCES: `src/app/components/LanguageSwitcher.tsx` (new file)

INSTRUCTIONS:
1. Create the file with this implementation:

```tsx
"use client";
import { useState, useEffect } from "react";

export type Lang = "pl" | "en";
const STORAGE_KEY = "powietrze_lang";

export function useLang(): [Lang, (l: Lang) => void] {
  const [lang, setLangState] = useState<Lang>("pl");
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "pl" || stored === "en") setLangState(stored);
  }, []);
  const setLang = (l: Lang) => {
    localStorage.setItem(STORAGE_KEY, l);
    setLangState(l);
  };
  return [lang, setLang];
}

type Props = { lang: Lang; onChange: (l: Lang) => void; };

export default function LanguageSwitcher({ lang, onChange }: Props) {
  const base: React.CSSProperties = {
    padding: "4px 12px", fontSize: 12, fontWeight: 500,
    borderRadius: 20, cursor: "pointer", border: "0.5px solid",
    transition: "all 0.15s",
  };
  const active: React.CSSProperties = {
    ...base, background: "#D4213D", borderColor: "#D4213D", color: "#ffffff",
  };
  const inactive: React.CSSProperties = {
    ...base, background: "transparent", borderColor: "var(--color-border-secondary)",
    color: "var(--color-text-secondary)",
  };
  return (
    <div style={{ display: "flex", gap: 4 }}>
      <button style={lang === "pl" ? active : inactive} onClick={() => onChange("pl")}>PL</button>
      <button style={lang === "en" ? active : inactive} onClick={() => onChange("en")}>EN</button>
    </div>
  );
}
```

CONSTRAINTS:
- `useLang` hook and `LanguageSwitcher` component must be in the same file
- Active colour must be exactly `#D4213D` — do not use the CSS variable here (SSR mismatch risk)
- No third-party i18n library

VERIFY:
```bash
npx tsc --noEmit
# Expected: exit code 0
```

COMMIT: `feat: add LanguageSwitcher component and useLang hook`

---

### Step 2b.4 — Create `src/app/components/SourceBadge.tsx`

READS: `src/app/components/PolishFlagIcon.tsx`

PRODUCES: `src/app/components/SourceBadge.tsx` (new file)

INSTRUCTIONS:
1. Create the file with this implementation:

```tsx
import PolishFlagIcon from "./PolishFlagIcon";

export type SourceKey = "gios" | "airly" | "eu_directive" | "who";

const SOURCE_DATA: Record<SourceKey, {
  icon: React.ReactNode;
  name: string;
  desc_pl: string;
  desc_en: string;
}> = {
  gios: {
    icon: <PolishFlagIcon />,
    name: "GIOŚ",
    desc_pl: "Oficjalne dane rządowe",
    desc_en: "Official government data",
  },
  airly: {
    icon: <PolishFlagIcon />,
    name: "Airly",
    desc_pl: "Krakowska sieć czujników",
    desc_en: "Kraków sensor network",
  },
  eu_directive: {
    icon: (
      <div style={{ width: 20, height: 14, borderRadius: 2, background: "#003399",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 9, color: "#FFD700", flexShrink: 0 }}>★</div>
    ),
    name: "Dyrektywa UE 2024/2881",
    desc_pl: "Normy na 2030 r.",
    desc_en: "2030 targets",
  },
  who: {
    icon: (
      <div style={{ width: 20, height: 14, borderRadius: 2, background: "#009EDB",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 7, color: "#ffffff", fontWeight: 700, flexShrink: 0 }}>WHO</div>
    ),
    name: "WHO AQG 2021",
    desc_pl: "Wytyczne zdrowotne",
    desc_en: "Health guidelines",
  },
};

type Props = { source: SourceKey; lang?: "pl" | "en"; };

export default function SourceBadge({ source, lang = "pl" }: Props) {
  const s = SOURCE_DATA[source];
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 7,
      border: "0.5px solid var(--color-border-tertiary)",
      borderRadius: 8, padding: "6px 12px",
      background: "var(--color-background-primary)",
    }}>
      {s.icon}
      <div>
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-primary)" }}>
          {s.name}
        </div>
        <div style={{ fontSize: 10.5, color: "var(--color-text-secondary)" }}>
          {lang === "pl" ? s.desc_pl : s.desc_en}
        </div>
      </div>
    </div>
  );
}
```

CONSTRAINTS:
- No other sources may be added in this step
- `SOURCE_DATA` is a module-level constant — do not make it configurable via props

VERIFY:
```bash
npx tsc --noEmit
# Expected: exit code 0
```

COMMIT: `feat: add SourceBadge component — GIOŚ, Airly, EU, WHO with flag icons`

---

### Step 2b.5 — Create `src/app/components/Navbar.tsx`

READS: `src/app/components/PolishFlagIcon.tsx`, `src/app/components/LanguageSwitcher.tsx`, `src/app/layout.tsx`

PRODUCES: `src/app/components/Navbar.tsx` (new file)

INSTRUCTIONS:
1. Create the file with this implementation:

```tsx
"use client";
import PolishFlagIcon from "./PolishFlagIcon";
import LanguageSwitcher, { type Lang } from "./LanguageSwitcher";

type Props = {
  lang: Lang;
  onLangChange: (l: Lang) => void;
  cityLabel?: string;
};

export default function Navbar({ lang, onLangChange, cityLabel }: Props) {
  return (
    <header style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 20px",
      height: 52,
      background: "var(--color-background-primary)",
      borderBottom: "3px solid #D4213D",
      flexShrink: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <PolishFlagIcon width={24} height={16} />
        <span style={{
          fontSize: 16, fontWeight: 500,
          color: "var(--color-text-primary)",
          letterSpacing: "-0.01em",
        }}>
          <span style={{ color: "#D4213D" }}>P</span>owietrze
        </span>
        {cityLabel && (
          <span style={{ fontSize: 13, color: "var(--color-text-secondary)", marginLeft: 4 }}>
            · {cityLabel}
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <LanguageSwitcher lang={lang} onChange={onLangChange} />
      </div>
    </header>
  );
}
```

CONSTRAINTS:
- Nav background is always white (`var(--color-background-primary)`) — never dark, never changes with AQI level
- The `3px solid #D4213D` bottom border is hardcoded — not a variable, not conditional
- Logo "P" colour is hardcoded `#D4213D` — not a variable
- No navigation links in this step — the navbar is identity chrome only

VERIFY:
```bash
npx tsc --noEmit
# Expected: exit code 0
```

COMMIT: `feat: add Navbar with Polish identity — flag icon, red bottom border, P accent`

---

## PHASE 3 — AQI Dashboard Card components

### Step 3.1 — Create `src/app/components/ActivityMatrix.tsx`

READS: `src/lib/aqi-config.ts` — specifically: `AQI_LEVEL_CONFIGS`, `ACTIVITY_DISPLAY_ORDER`, `ACTIVITY_LABELS`, `ActivityState`

PRODUCES: `src/app/components/ActivityMatrix.tsx` (new file)

INSTRUCTIONS:
1. Create the file with this exact TypeScript interface and implementation:

```tsx
import {
  AQI_LEVEL_CONFIGS, ACTIVITY_DISPLAY_ORDER, ACTIVITY_LABELS,
} from "@/lib/aqi-config";
import type { AqiLevelKey, ActivityKey, ActivityState } from "@/lib/aqi-config";

type Props = {
  levelKey: Exclude<AqiLevelKey, "no_data">;
  lang: "pl" | "en";
};

const STATE_STYLES: Record<ActivityState, { bg: string; color: string; icon: string }> = {
  safe:    { bg: "#EAF3DE", color: "#27500A", icon: "✓" },
  caution: { bg: "#FAEEDA", color: "#633806", icon: "~" },
  avoid:   { bg: "#FCEBEB", color: "#791F1F", icon: "✗" },
};

export default function ActivityMatrix({ levelKey, lang }: Props) {
  const cfg = AQI_LEVEL_CONFIGS[levelKey];

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(5, 1fr)",
      gap: 6,
    }}>
      {ACTIVITY_DISPLAY_ORDER.map((actKey: ActivityKey) => {
        const cell = cfg.activities[actKey];
        const label = ACTIVITY_LABELS[actKey];
        const style = STATE_STYLES[cell.state];
        const note = lang === "pl" ? cell.note_pl : cell.note_en;

        return (
          <div key={actKey} style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            gap: 4, padding: "8px 4px",
            borderRadius: 8,
            background: "var(--color-background-secondary)",
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 500,
              background: style.bg, color: style.color,
            }}>
              {style.icon}
            </div>
            <div style={{
              fontSize: 10, textAlign: "center", lineHeight: 1.3,
              color: "var(--color-text-secondary)",
            }}>
              {lang === "pl" ? label.pl : label.en}
            </div>
            {note && (
              <div style={{
                fontSize: 10, textAlign: "center", lineHeight: 1.3,
                color: "var(--color-text-secondary)", opacity: 0.75,
              }}>
                {note}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

CONSTRAINTS:
- State colours (`#EAF3DE`, `#FAEEDA`, `#FCEBEB`) are fixed and do not come from `levelKey` — they represent the activity state, not the AQI level
- `STATE_STYLES` is a module-level constant — not dynamic
- Do not accept `"no_data"` as a valid `levelKey` — the type explicitly excludes it
- No Tailwind classes

VERIFY:
```bash
npx tsc --noEmit
# Expected: exit code 0
```

COMMIT: `feat: add ActivityMatrix component — 5 activities × 5 AQI levels`

---

### Step 3.2 — Create `src/app/components/ComplianceModal.tsx`

READS: `src/lib/aqi-config.ts` — specifically: `BENCHMARKS`, `getComplianceBadge`, `DISCLAIMER`

PRODUCES: `src/app/components/ComplianceModal.tsx` (new file)

INSTRUCTIONS:
1. Create the file with this exact implementation:

```tsx
"use client";
import { useEffect } from "react";
import { BENCHMARKS, DISCLAIMER } from "@/lib/aqi-config";
import SourceBadge from "./SourceBadge";
import type { Lang } from "./LanguageSwitcher";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  lang: Lang;
};

type BenchmarkRow = {
  source: "gios" | "eu_directive" | "who";
  label_pl: string;
  label_en: string;
  value: number;
  valueLabel: string;
  desc_pl: string;
  desc_en: string;
  color: string;
};

const ROWS: BenchmarkRow[] = [
  {
    source: "gios",
    label_pl: "Kraków — średnia roczna PM2.5",
    label_en: "Kraków annual average PM2.5",
    value: BENCHMARKS.krakow_annual_pm25,
    valueLabel: `~${BENCHMARKS.krakow_annual_pm25} µg/m³`,
    desc_pl: "Najwyższe stężenia PM10 spośród 9 głównych miast Polski (2019–2024).",
    desc_en: "Highest PM10 concentrations among 9 major Polish cities (2019–2024).",
    color: "#E24B4A",
  },
  {
    source: "eu_directive",
    label_pl: `Obecny limit UE (Dyrektywa 2008/50/EC)`,
    label_en: "Current EU limit (Directive 2008/50/EC)",
    value: BENCHMARKS.eu_current_limit_pm25,
    valueLabel: `${BENCHMARKS.eu_current_limit_pm25} µg/m³`,
    desc_pl: "Kraków już teraz przekracza ten limit.",
    desc_en: "Kraków already exceeds this limit.",
    color: "#EF9F27",
  },
  {
    source: "eu_directive",
    label_pl: `Cel UE na ${BENCHMARKS.eu_2030_deadline_year} r. (Dyrektywa 2024/2881)`,
    label_en: `EU ${BENCHMARKS.eu_2030_deadline_year} target (Directive 2024/2881)`,
    value: BENCHMARKS.eu_2030_target_pm25,
    valueLabel: `${BENCHMARKS.eu_2030_target_pm25} µg/m³`,
    desc_pl: "Obywatele zyskują prawo do odszkodowania za szkody zdrowotne, jeśli norma nie zostanie dotrzymana.",
    desc_en: "Citizens gain the right to compensation for health damages if this target is missed.",
    color: "#639922",
  },
  {
    source: "who",
    label_pl: "Zalecenie WHO (2021)",
    label_en: "WHO guideline (2021)",
    value: BENCHMARKS.who_annual_pm25,
    valueLabel: `${BENCHMARKS.who_annual_pm25} µg/m³`,
    desc_pl: "Poziom, przy którym powietrze jest naprawdę bezpieczne. Kraków jest 6× powyżej tej wartości.",
    desc_en: "The level at which air is genuinely safe. Kraków is 6× above this value.",
    color: "#1D9E75",
  },
];

export default function ComplianceModal({ isOpen, onClose, lang }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (isOpen) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxValue = BENCHMARKS.krakow_annual_pm25;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      <div style={{
        background: "var(--color-background-primary)",
        borderRadius: 12,
        border: "0.5px solid var(--color-border-secondary)",
        width: "100%", maxWidth: 440,
        maxHeight: "82vh", overflowY: "auto",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px",
          borderBottom: "0.5px solid var(--color-border-tertiary)",
          display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8,
        }}>
          <div style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-primary)", lineHeight: 1.35 }}>
            {lang === "pl"
              ? "Kraków a normy jakości powietrza"
              : "Kraków and air quality standards"}
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--color-text-secondary)", fontSize: 18, lineHeight: 1,
            padding: "2px 4px", borderRadius: 4,
          }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: "16px 20px" }}>
          <p style={{ fontSize: 13, lineHeight: 1.65, color: "var(--color-text-secondary)", marginBottom: 16 }}>
            {lang === "pl"
              ? "Kraków ma jeden z najgorszych wskaźników jakości powietrza w Polsce. Oto jak obecne stężenia wypadają na tle norm prawnych i zaleceń zdrowotnych."
              : "Kraków has one of the worst air quality records in Poland. Here is how current concentrations compare against legal limits and health guidelines."}
          </p>

          {/* Benchmark bars */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            {ROWS.map((row, i) => (
              <div key={i} style={{
                background: "var(--color-background-secondary)",
                borderRadius: 8, padding: "10px 12px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4, gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-primary)", flex: 1 }}>
                    {lang === "pl" ? row.label_pl : row.label_en}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: row.color, whiteSpace: "nowrap" }}>
                    {row.valueLabel}
                  </span>
                </div>
                <div style={{ background: "var(--color-border-tertiary)", height: 6, borderRadius: 3, overflow: "hidden", marginBottom: 4 }}>
                  <div style={{
                    height: 6, borderRadius: 3,
                    width: `${Math.round((row.value / maxValue) * 100)}%`,
                    background: row.color,
                    transition: "width 0.6s ease",
                  }} />
                </div>
                <div style={{ fontSize: 11.5, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
                  {lang === "pl" ? row.desc_pl : row.desc_en}
                </div>
                <div style={{ marginTop: 6 }}>
                  <SourceBadge source={row.source} lang={lang} />
                </div>
              </div>
            ))}
          </div>

          {/* Boiler fact */}
          <div style={{
            fontSize: 12.5, lineHeight: 1.65,
            background: "#FAEEDA", borderRadius: 8, padding: "10px 14px",
            marginBottom: 10,
          }}>
            <strong style={{ color: "#633806" }}>
              {lang === "pl"
                ? `~${BENCHMARKS.household_boiler_pm_share_pct}% pyłu zawieszonego w Polsce pochodzi z domowych kotłów i kominków`
                : `~${BENCHMARKS.household_boiler_pm_share_pct}% of particulate matter in Poland comes from household boilers and fireplaces`}
            </strong>
            {lang === "pl"
              ? " — nie z ruchu drogowego. Zakaz palenia węglem i drewnem w Krakowie obowiązuje od 2019 r."
              : " — not from traffic. Coal and wood burning in Kraków has been banned since 2019."}
          </div>

          {/* Disclaimer */}
          <div style={{
            fontSize: 11, color: "var(--color-text-tertiary)", lineHeight: 1.55,
            borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: 10,
          }}>
            {lang === "pl" ? DISCLAIMER.pl : DISCLAIMER.en}
          </div>
        </div>
      </div>
    </div>
  );
}
```

CONSTRAINTS:
- All numeric values (`BENCHMARKS.*`) are imported from `aqi-config.ts` — none hardcoded in this file
- `ROWS` is a module-level constant — computed once at module load, not on every render
- Bar widths are computed as `(row.value / BENCHMARKS.krakow_annual_pm25) * 100` — the denominator is always the Kraków value
- Modal closes on Escape key, backdrop click, and × button — all three

VERIFY:
```bash
npx tsc --noEmit
# Expected: exit code 0
```

COMMIT: `feat: add ComplianceModal with benchmark bars, source badges, disclaimer`

---

### Step 3.3 — Create `src/app/components/ComplianceBadge.tsx`

READS: `src/lib/aqi-config.ts` — specifically: `getComplianceBadge`, `BENCHMARKS`, `ComplianceBadgeVariant`

PRODUCES: `src/app/components/ComplianceBadge.tsx` (new file)

INSTRUCTIONS:
1. Create the file with this exact implementation:

```tsx
"use client";
import { useState } from "react";
import { getComplianceBadge } from "@/lib/aqi-config";
import ComplianceModal from "./ComplianceModal";
import type { Lang } from "./LanguageSwitcher";

type Props = { lang: Lang; };

const SEVERITY_STYLES = {
  green: { bg: "#EAF3DE", border: "#3B6D11", color: "#27500A" },
  amber: { bg: "#FAEEDA", border: "#854F0B", color: "#633806" },
  red:   { bg: "#FCEBEB", border: "#A32D2D", color: "#791F1F" },
};

export default function ComplianceBadge({ lang }: Props) {
  const [open, setOpen] = useState(false);
  const badge = getComplianceBadge();
  const s = SEVERITY_STYLES[badge.severity];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: s.bg, border: `0.5px solid ${s.border}`,
          color: s.color, fontSize: 12, fontWeight: 500,
          padding: "5px 12px", borderRadius: 20, cursor: "pointer",
          transition: "opacity 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1"/>
          <line x1="6" y1="4" x2="6" y2="6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          <circle cx="6" cy="8.2" r="0.6" fill="currentColor"/>
        </svg>
        {lang === "pl" ? badge.text_pl : badge.text_en}
      </button>
      <ComplianceModal isOpen={open} onClose={() => setOpen(false)} lang={lang} />
    </>
  );
}
```

CONSTRAINTS:
- `getComplianceBadge()` is called with no arguments — uses `BENCHMARKS.krakow_annual_pm25` as default
- `SEVERITY_STYLES` colours are hardcoded hex — matching exactly the values in `aqi-config-spec.md` section 2
- No `useEffect` in this component

VERIFY:
```bash
npx tsc --noEmit
# Expected: exit code 0
```

COMMIT: `feat: add ComplianceBadge — computed text, opens ComplianceModal`

---

### Step 3.4 — Create `src/app/components/AqiDashboardCard.tsx`

READS:
- `src/lib/aqi-config.ts` — `AQI_LEVEL_CONFIGS`, `AQI_NO_DATA_CONFIG`, `SEASONAL_RULES`, `GOOD_DAY_LEVELS`, `GOOD_DAY_MIN_DAYS`
- `src/app/components/ActivityMatrix.tsx`
- `src/app/components/AqiBadge.tsx`
- `src/app/components/ComplianceBadge.tsx`

PRODUCES: `src/app/components/AqiDashboardCard.tsx` (new file)

INSTRUCTIONS:
1. Create the file with this exact TypeScript interface and implementation:

```tsx
import { getLevelConfig, SEASONAL_RULES, GOOD_DAY_LEVELS, GOOD_DAY_MIN_DAYS } from "@/lib/aqi-config";
import type { AqiLevelKey } from "@/lib/aqi-config";
import ActivityMatrix from "./ActivityMatrix";
import AqiBadge from "./AqiBadge";
import ComplianceBadge from "./ComplianceBadge";
import type { Lang } from "./LanguageSwitcher";

type Props = {
  levelKey: AqiLevelKey;
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  stationName: string;
  updatedAt: string;        // ISO string — formatted inside the component
  lang: Lang;
  percentile?: number | null;       // % of days this year with worse air; null if < GOOD_DAY_MIN_DAYS days
  dataPointCount?: number;          // number of historical readings available
};

function formatUpdated(iso: string, lang: Lang): string {
  try {
    return new Date(iso).toLocaleString(lang === "pl" ? "pl-PL" : "en-GB", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function AqiDashboardCard({
  levelKey, pm25, pm10, no2, stationName, updatedAt, lang,
  percentile = null, dataPointCount = 0,
}: Props) {
  const cfg = getLevelConfig(levelKey);
  const isNoData = levelKey === "no_data";
  const month = new Date().getMonth() + 1; // 1-indexed

  // Seasonal rules: collect all that apply
  const seasonalMessages = isNoData ? [] : SEASONAL_RULES
    .filter(r => r.condition(month, levelKey))
    .map(r => lang === "pl" ? r.message_pl : r.message_en);

  // Good day percentile message
  const showPercentile =
    !isNoData &&
    percentile !== null &&
    dataPointCount >= GOOD_DAY_MIN_DAYS &&
    (GOOD_DAY_LEVELS as AqiLevelKey[]).includes(levelKey);

  const stat = (label: string, value: number | null) => (
    <div style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "8px 12px" }}>
      <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 500, color: "var(--color-text-primary)" }}>
        {value !== null ? value : "—"}
      </div>
      <div style={{ fontSize: 10, color: "var(--color-text-secondary)" }}>µg/m³</div>
    </div>
  );

  return (
    <div style={{
      borderRadius: 12,
      border: `0.5px solid ${cfg.color.border}`,
      overflow: "hidden",
    }}>
      {/* Header band */}
      <div style={{ background: cfg.color.bg, padding: "14px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <AqiBadge levelKey={levelKey} showEnglish size="md" />
          {pm25 !== null && (
            <span style={{ fontSize: 13, color: cfg.color.text }}>
              PM2.5: <strong>{pm25}</strong> µg/m³
            </span>
          )}
        </div>
        <div style={{ fontSize: 18, fontWeight: 500, color: cfg.color.text, lineHeight: 1.35, marginBottom: 4 }}>
          {isNoData
            ? (lang === "pl" ? "Brak danych z czujników." : "No sensor data available.")
            : (lang === "pl" ? cfg.copy.headline_pl : cfg.copy.headline_en)}
        </div>
        {!isNoData && (
          <div style={{ fontSize: 13, color: cfg.color.text, opacity: 0.75 }}>
            {lang === "pl" ? cfg.copy.headline_en : cfg.copy.headline_pl}
          </div>
        )}
        {/* Activity matrix — only when not no_data */}
        {!isNoData && levelKey !== "no_data" && (
          <div style={{ marginTop: 12 }}>
            <ActivityMatrix levelKey={levelKey as Exclude<AqiLevelKey, "no_data">} lang={lang} />
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: "14px 20px" }}>
        {/* Pollutant stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
          {stat("PM2.5", pm25)}
          {stat("PM10", pm10)}
          {stat("NO₂", no2)}
        </div>

        {/* Context note */}
        {!isNoData && (
          <div style={{
            fontSize: 12, lineHeight: 1.65, color: "var(--color-text-secondary)",
            background: "var(--color-background-secondary)", borderRadius: 8,
            padding: "8px 12px", marginBottom: seasonalMessages.length > 0 ? 8 : 12,
          }}>
            {lang === "pl" ? cfg.copy.context_pl : cfg.copy.context_en}
          </div>
        )}

        {/* Seasonal messages */}
        {seasonalMessages.map((msg, i) => (
          <div key={i} style={{
            fontSize: 12, lineHeight: 1.65, color: "var(--color-text-secondary)",
            borderLeft: `3px solid ${cfg.color.border}`,
            paddingLeft: 10, marginBottom: 8,
          }}>
            {msg}
          </div>
        ))}

        {/* Good day percentile */}
        {showPercentile && (
          <div style={{
            fontSize: 12, lineHeight: 1.65, color: "var(--color-text-secondary)",
            background: cfg.color.bg, borderRadius: 8, padding: "8px 12px", marginBottom: 12,
          }}>
            {lang === "pl"
              ? `Dziś powietrze jest czystsze niż w ${percentile}% dni tego roku w Krakowie.`
              : `Today's air is cleaner than ${percentile}% of days this year in Kraków.`}
          </div>
        )}

        {/* Meta row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
            {stationName} · {formatUpdated(updatedAt, lang)}
          </span>
          <ComplianceBadge lang={lang} />
        </div>
      </div>
    </div>
  );
}
```

CONSTRAINTS:
- `percentile` prop is only rendered when `dataPointCount >= GOOD_DAY_MIN_DAYS` AND `levelKey` is in `GOOD_DAY_LEVELS` — both conditions must be true
- `formatUpdated` must never throw — the try/catch fallback must stay
- The `ActivityMatrix` is only rendered when `levelKey !== "no_data"`
- The `ComplianceBadge` renders in every state (including no_data)

VERIFY:
```bash
npx tsc --noEmit
# Expected: exit code 0
```

COMMIT: `feat: add AqiDashboardCard — full decision-language card with activity matrix`

---

## PHASE 4 — Single-page layout and Kraków data

### Step 4.1 — Add `/?city` focus state to `src/app/page.tsx`

READS:
- `src/app/page.tsx` (current dark-theme implementation — will be fully replaced)
- `src/lib/localData.ts`
- `src/app/components/Navbar.tsx`
- `src/app/components/AqiDashboardCard.tsx`
- `src/app/components/MapWrapper.tsx`

PRODUCES: replaced `src/app/page.tsx`

INSTRUCTIONS:
1. Replace the entire file. The new implementation must:
   - Import and render `Navbar` at the top, passing `lang` state and `onLangChange`
   - Use `useLang` hook from `LanguageSwitcher.tsx` for language state
   - Read `searchParams.city` and `searchParams.station` from Next.js page props
   - On desktop (≥1024px CSS): render a two-column layout — map left (60%), focus panel right (40%)
   - On mobile: map full-width at 40vh height, focus panel scrolls below
   - When no `city` param: show only the map with a national summary strip (3 metric cards: worst / median / best PM2.5 city today, using `getAllStations()`)
   - When `city=krakow`: show the map + render `AqiDashboardCard` in the focus panel, using data from `getKrakowStations()` and `getPrimaryKrakowStation()` from `localData.ts`, mapping `level_name` using `giosLabelToKey()` from `aqi-config.ts`
   - The national summary strip always uses data from `getAllStations()`
   - Background colour: `var(--color-background-tertiary)` (never `#0a0f1e`)
   - All text colours from CSS variables — no hardcoded dark colours
2. Map markers: update the legend to use `getLevelConfig(giosLabelToKey(station.aqi.level_name)).color.primary` for each level colour

CONSTRAINTS:
- Do not delete or modify `MapWrapper.tsx` or `PolandMap.tsx`
- Do not add Supabase calls in this step — use `localData.ts` only
- The dark background (`#0a0f1e`) must not appear anywhere in the new file
- Do not add the `/krakow` redirect in this step — that is Step 4b.1

VERIFY:
```bash
npx tsc --noEmit
# Expected: exit code 0
# Manual: run `npm run dev`, open http://localhost:3000 — white/neutral background, Polish nav visible
# Manual: open http://localhost:3000/?city=krakow — AqiDashboardCard renders in right panel
```

COMMIT: `feat: replace dark homepage with single-page light layout, ?city focus state`

---

### Step 4b.1 — Add `/krakow` redirect in `next.config.ts`

READS: `next.config.ts`

PRODUCES: modified `next.config.ts`

INSTRUCTIONS:
1. Replace the contents of `next.config.ts` with:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  async redirects() {
    return [
      {
        source: "/krakow",
        destination: "/?city=krakow",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
```

CONSTRAINTS:
- Do not change `reactCompiler: true`
- `permanent: false` — this is a 307, not a 301 — the route may change in future

VERIFY:
```bash
npx tsc --noEmit
# Expected: exit code 0
# Manual: run `npm run dev`, navigate to http://localhost:3000/krakow
# Expected: redirected to http://localhost:3000/?city=krakow
```

COMMIT: `chore: add /krakow → /?city=krakow redirect in next.config.ts`

---

### Step 4b.2 — Remove `/krakow` route

READS: `src/app/krakow/` directory

PRODUCES: deleted `src/app/krakow/` directory

INSTRUCTIONS:
1. Delete the entire `src/app/krakow/` directory including `page.tsx` and `KrakowMap.tsx`

CONSTRAINTS:
- Confirm the redirect in Step 4b.1 is committed and verified before running this step

VERIFY:
```bash
ls src/app/krakow/ 2>&1
# Expected: "No such file or directory"
npx tsc --noEmit
# Expected: exit code 0
```

COMMIT: `refactor: remove /krakow route — superseded by /?city=krakow focus state`

---

## PHASE 5 — Seasonal calendar

### Step 5.1 — Create `src/app/components/SeasonalCalendar.tsx`

READS:
- `src/lib/aqi-config.ts` — `AQI_LEVEL_CONFIGS`, `pm25ToLevelKey`, `AQI_NO_DATA_CONFIG`
- `src/lib/localData.ts` — `getKrakowReadings()`

PRODUCES: `src/app/components/SeasonalCalendar.tsx` (new file)

INSTRUCTIONS:
1. The component accepts this props interface:
```tsx
type DayReading = { date: string; avgPm25: number | null; }; // date: "YYYY-MM-DD"
type Props = {
  readings: DayReading[];
  lang: "pl" | "en";
};
```
2. If `readings.length < 7`: render a placeholder `<div>` with text `"Kalendarz będzie dostępny po zebraniu pierwszych danych."` (PL) or `"Calendar will be available once data has been collected."` (EN). Do not render an empty grid.
3. Otherwise: render a D3-powered calendar heatmap using `import * as d3 from "d3"`. Each day cell: 11×11px on desktop, 9×9px on mobile. Cell colour: `pm25ToLevelKey(avgPm25) → getLevelConfig(key).color.primary`. No-data days: `#D3D1C7`.
4. Layout: weeks as columns, Monday at top, month labels along top.
5. Tooltip on hover: date formatted in locale + level label + PM2.5 value.
6. The component must be `"use client"`.
7. On mobile, the calendar container has `overflowX: "auto"` — horizontal scroll is intentional.

CONSTRAINTS:
- Use D3 only for this component — not Recharts
- Do not use `any` for D3 types — import `d3.Selection`, `d3.ScaleOrdinal` etc. correctly
- The `<7 readings` placeholder must render first (guard clause at top of component)

VERIFY:
```bash
npx tsc --noEmit
# Expected: exit code 0
```

COMMIT: `feat: add SeasonalCalendar D3 heatmap component`

---

## PHASE 6 — Historical chart

### Step 6.1 — Create `src/app/components/PollutantChart.tsx`

READS: `src/lib/aqi-config.ts` — specifically: `BENCHMARKS`

PRODUCES: `src/app/components/PollutantChart.tsx` (new file)

INSTRUCTIONS:
1. The component accepts this props interface:
```tsx
type DataPoint = { date: string; value: number; }; // date: ISO string
type Props = {
  data: DataPoint[];
  pollutant: "pm25" | "pm10" | "no2" | "o3" | "so2";
  lang: "pl" | "en";
};
```
2. Render a Recharts `LineChart` with `ResponsiveContainer` at `width="100%" height={240}`.
3. For `pollutant === "pm25"` only: add a `ReferenceLine` at `y={BENCHMARKS.who_24h_pm25}` with label `"WHO"`. Value comes from `BENCHMARKS.who_24h_pm25` — never hardcoded.
4. Time range selector buttons: `24h`, `7d`, `30d`, `90d` — filter `data` prop client-side. Default: `24h`.
5. The component must be `"use client"`.

CONSTRAINTS:
- `BENCHMARKS.who_24h_pm25` is the only value from `aqi-config.ts` used here — do not import other BENCHMARKS
- No hardcoded numeric threshold values anywhere in this file
- Chart line colour: `"#5F5E5A"` (neutral) — do not use AQI level colours for chart lines

VERIFY:
```bash
npx tsc --noEmit
# Expected: exit code 0
```

COMMIT: `feat: add PollutantChart with Recharts, WHO 24h reference line`

---

## PHASE 7 — Warning banner

### Step 7.1 — Create `src/app/components/WarningBanner.tsx`

READS: `src/lib/aqi-config.ts` — `AQI_LEVEL_CONFIGS`

PRODUCES: `src/app/components/WarningBanner.tsx` (new file)

INSTRUCTIONS:
1. The component accepts this props interface:
```tsx
type Props = {
  levelKey: AqiLevelKey;
  lang: "pl" | "en";
};
```
2. Return `null` if `levelKey` is not `"zly"` or `"bardzo_zly"`. These are the only levels that trigger the banner.
3. Dismissal: use `sessionStorage` key `"powietrze_banner_dismissed_" + levelKey`. If key exists, return `null`. On dismiss button click: set the key and hide the banner.
4. Banner structure: sticky `position: "sticky"`, `top: 0`, `zIndex: 50`. Background `cfg.color.bg`, border-bottom `cfg.color.border`. Content: `cfg.copy.headline_pl` (or EN), dismiss `×` button right-aligned.
5. The component must be `"use client"`.

CONSTRAINTS:
- Only renders for `"zly"` and `"bardzo_zly"` — exact check, not score-based
- `sessionStorage` key includes `levelKey` so a new session shows the banner again if level changed

VERIFY:
```bash
npx tsc --noEmit
# Expected: exit code 0
```

COMMIT: `feat: add WarningBanner — sticky, dismissible, zly and bardzo_zly only`

---

## PHASE 8 — Footer

### Step 8.1 — Create `src/app/components/Footer.tsx`

READS: `src/app/components/SourceBadge.tsx`, `src/lib/aqi-config.ts` — `DISCLAIMER`

PRODUCES: `src/app/components/Footer.tsx` (new file)

INSTRUCTIONS:
1. The component accepts: `type Props = { lang: "pl" | "en"; };`
2. Render: a row of four `SourceBadge` components (`gios`, `airly`, `eu_directive`, `who`), then the disclaimer text from `DISCLAIMER[lang]`, then a copyright line `© ${new Date().getFullYear()} Powietrze`.
3. Background: `var(--color-background-secondary)`. Top border: `0.5px solid var(--color-border-tertiary)`. Padding: `24px 20px`.

CONSTRAINTS:
- `DISCLAIMER` text comes from `aqi-config.ts` — not hardcoded in this file

VERIFY:
```bash
npx tsc --noEmit
# Expected: exit code 0
```

COMMIT: `feat: add Footer with source badges and disclaimer`

---

## END OF BUILD PLAN — MVP complete after Phase 8
