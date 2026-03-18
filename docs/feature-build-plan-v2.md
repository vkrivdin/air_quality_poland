# Powietrze — Feature Build Plan v2
**Replaces:** `feature-build-plan.md` v1.0
**Version:** 2.0 | **For:** AI coding agents and human developers | **Last updated:** March 2026
**Prerequisite:** `docs/build-plan.md` Phases 0–8 complete. `docs/local-data-collection-plan.md` H1–H5 complete (or H3.2 minimum).

---

## WHAT CHANGED FROM V1 AND WHY

Before reading the steps, read this section. It explains what was wrong with v1 and the reasoning behind every structural change.

### What was wrong in v1

**The navigation was inside-out.** v1 placed the national map first and asked users to navigate down to meaning. Real data apps (weather apps, Windy, financial apps) show the meaningful sentence first and let exploration follow. Users who don't already care about air quality data have no hook. v2 inverts this: meaning comes first, exploration follows.

**The national summary strip was three dead numbers.** "Worst: Kraków 47 µg/m³ / Median: Poznań 22 µg/m³ / Best: Zakopane 8 µg/m³" tells you nothing you'll remember or share. v2 replaces it with a generated **"Today's Story"** sentence computed from actual data patterns — "Kraków's air is the cleanest it's been in 6 weeks" or "This is Wrocław's first smog alert of the year." This is the shareable, memorable thing.

**Context-switching on map zoom was unimplementable and confusing.** v1's D2 promised that the activity matrix would update as the user pans the map. This was never specced with actual Leaflet event wiring, and the user experience of recommendations silently changing when you pan is disorienting. v2 cuts implicit zoom-based context changes entirely. Context changes only on explicit navigation (clicking a city, clicking a station). Explicit always beats implicit in spatial UIs.

**The MetricCardRow API was architecturally broken.** Passing 500 station IDs in a query string to a server that has direct SQLite access is backwards. v2 changes the context API to accept a `city` slug or `scope=national` and resolves station IDs server-side.

**The PollutantBandChart gradient id was stale across time range changes.** SVG gradient ids need to include both `stationId` AND `days` to avoid the browser reusing the wrong gradient when the time range changes. Fixed in v2.

**The timeline was a destination with no way back into exploration.** v2 makes the timeline bidirectionally connected: every chart spike is clickable and opens the nearest event card. Every event card has a "Pokaż na wykresie" link that scrolls the chart to that date and highlights it. The timeline is a conversation between data and context, not a chart followed by a list.

**No data freshness signalling anywhere.** A user looking at "Bardzo dobry" recommendations based on 8-hour-old data is being misled. v2 adds a `DataFreshnessBanner` that appears on all data-presenting components when readings are older than 3 hours.

**Nothing was shareable.** v2 adds a share button to every primary view that copies a URL encoding the current state (city, station, time range, date). This is how data apps spread.

**The sparse pollutant grid looked broken.** Most stations outside major cities only measure 2–3 pollutants. Showing 6 cells with four `—` looks like an error. v2 renders only cells with non-null data, with a note "Only PM2.5 and PM10 monitored at this station."

**The flow between elements had no narrative connective tissue.** v1 built isolated components. v2 designs each component to have one clear "next step" that deepens engagement: Map → Station card → Mini trend → Full chart → Timeline. Every surface leads somewhere.

---

## DESIGN PRINCIPLES FOR v2

### P1 — Three user types, one coherent flow

**The worried resident** needs: one clear answer immediately (is it safe now?), then one sentence of context (why), then one action (what to do).

**The curious explorer** needs: something surprising, a comparison they didn't expect, a hook that makes them say "I didn't know that." Then a clear path to dig deeper.

**The data person** needs: station-level detail, raw numbers, historical charts, methodology links. They'll self-serve if the entry points exist.

The flow is: Story → Map → Station → Chart → Timeline. Each step is optional. The Story hooks the resident; the map hooks the explorer; the station hooks the data person. Nobody is forced through a step they don't want.

### P2 — Every component has one "next step"

| Component | Next step |
|---|---|
| Today's Story | Click city name → focus that city on the map |
| Map marker | Click → Station card slides in |
| Station card mini trend | "Pełna historia →" → Timeline with station context |
| Metric card | Click → Timeline filtered to that pollutant |
| Activity matrix | Click activity → Explanation modal (why this recommendation) |
| Timeline chart spike | Click → nearest event card highlights |
| Timeline event card | "Pokaż na wykresie →" → chart scrolls to that date |
| Compliance badge | Click → Compliance modal with benchmark bars |

### P3 — Meaning before exploration, always

On mobile: Story sentence → map → detail. Never start with the map on mobile.
On desktop: Story in the national strip, map always visible, detail panel alongside.

### P4 — Data freshness is always visible

Any component showing readings older than 3 hours renders a small amber indicator. Any component with data older than 12 hours renders a red indicator and replaces recommendations with "Data too old to advise." This is a trust requirement, not a feature.

### P5 — Shareability at every depth

Every view has a URL that encodes full state and a copy-link button. `/timeline?city=krakow&pollutant=pm25&from=2024-01-01&to=2024-03-01` is a shareable, bookmarkable thing. The share button copies the current URL to clipboard. No native share API, no modal — just copy.

---

## HOW TO READ THIS DOCUMENT

```
### Step N.N — Name
READS:        files the agent must read before starting this step
PRODUCES:     files the agent will create or modify
REMOVES:      files or code the agent must delete (new in v2)
INSTRUCTIONS: numbered, imperative, complete
CONSTRAINTS:  things the agent must NOT do
VERIFY:       exact shell commands and expected output
COMMIT:       exact commit message string
```

---

## PHASE F0 — Foundation fixes (before building any new features)

These steps fix the structural problems in the existing codebase that would cause the new features to break or mislead users. They must be completed before any Phase F1+ step.

### Step F0.1 — Replace national summary strip with `TodayStory`

READS:
- `src/app/components/PageShell.tsx` — national summary strip (lines containing `national.worst`, `national.median`, `national.best`)
- `src/lib/aqi-config.ts` — `getLevelConfig`, `giosLabelToKey`
- `src/lib/localDb.ts` — `getDailyReadings`

PRODUCES:
- `src/app/api/story/today/route.ts` (new file)
- `src/app/components/TodayStory.tsx` (new file)
- modified `src/app/components/PageShell.tsx`

INSTRUCTIONS:

1. Create `src/app/api/story/today/route.ts`:

```typescript
// GET /api/story/today
// Computes one "Today's Story" sentence from live readings data.
// Rules (evaluated in order — first match wins):
//   1. If any city has AQI = "bardzo_zly": "Alarm smogowy w {city}. PM2.5 wynosi {val}× normę WHO."
//   2. If best city today is ≥2 levels better than its own 30-day avg: "{city} ma dziś wyjątkowo czyste powietrze — najczystsze od {N} dni."
//   3. If worst city PM2.5 > 2× its own 30-day avg: "Dziś {city} jest {X}× bardziej zanieczyszczone niż zwykle."
//   4. If current national median is in "bardzo_dobry" or "dobry": "Dobry dzień na aktywność w Polsce. Większość miast ma czyste powietrze."
//   5. Fallback: "Polska: {N} stacji z dobrym powietrzem, {M} z przekroczeniami dziś."
//
// Returns:
//   { sentence_pl, sentence_en, level: AqiLevelKey, city: string | null }
// Level drives the sentence's colour in TodayStory component.

import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";
import { giosLabelToKey } from "@/lib/aqi-config";
import type { AqiLevelKey } from "@/lib/aqi-config";

const DB_PATH = path.resolve(process.cwd(), "data/local.db");
export const dynamic = "force-dynamic";
export const revalidate = 3600; // re-generate at most once per hour

type StoryResult = {
  sentence_pl: string;
  sentence_en: string;
  level: AqiLevelKey;
  city: string | null;
};

export async function GET(): Promise<NextResponse> {
  try {
    const db = new Database(DB_PATH, { readonly: true });

    // Latest reading per station (last 3 hours)
    const cutoff = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    const latest = db.prepare(`
      SELECT s.city, r.aqi_level, r.pm25, r.measured_at
      FROM readings r
      JOIN stations s ON r.station_id = s.id
      WHERE r.measured_at >= ?
      ORDER BY r.measured_at DESC
    `).all(cutoff) as Array<{ city: string; aqi_level: string | null; pm25: number | null; measured_at: string }>;

    db.close();

    if (latest.length === 0) {
      return NextResponse.json({
        sentence_pl: "Dane są chwilowo niedostępne.",
        sentence_en: "Data is temporarily unavailable.",
        level: "no_data" as AqiLevelKey,
        city: null,
      });
    }

    // City-level aggregation: worst reading per city
    const byCity = new Map<string, { level: AqiLevelKey; pm25: number }>();
    for (const r of latest) {
      const key = giosLabelToKey(r.aqi_level);
      const existing = byCity.get(r.city);
      const score = { no_data: 0, bardzo_dobry: 1, dobry: 2, umiarkowany: 3, zly: 4, bardzo_zly: 5 };
      if (!existing || score[key] > score[existing.level]) {
        byCity.set(r.city, { level: key, pm25: r.pm25 ?? 0 });
      }
    }

    const cities = Array.from(byCity.entries()).map(([city, d]) => ({ city, ...d }));
    const sorted = cities.sort((a, b) => {
      const score = { no_data: 0, bardzo_dobry: 1, dobry: 2, umiarkowany: 3, zly: 4, bardzo_zly: 5 };
      return score[b.level] - score[a.level];
    });

    const worst = sorted[0];
    const best = sorted[sorted.length - 1];
    const whoAnnual = 5;

    // Rule 1: smog alert anywhere
    if (worst?.level === "bardzo_zly") {
      const x = Math.round((worst.pm25 ?? 0) / whoAnnual);
      const result: StoryResult = {
        sentence_pl: `Alarm smogowy w ${worst.city}. PM2.5 przekracza normę WHO ${x}-krotnie.`,
        sentence_en: `Smog alert in ${worst.city}. PM2.5 is ${x}× above the WHO guideline.`,
        level: "bardzo_zly",
        city: worst.city,
      };
      return NextResponse.json(result);
    }

    // Rule 2: best city is unusually good (approximated: level "bardzo_dobry" while national median is "umiarkowany"+)
    const nationalScores = cities.map(c => ({ no_data: 0, bardzo_dobry: 1, dobry: 2, umiarkowany: 3, zly: 4, bardzo_zly: 5 }[c.level] ?? 0));
    const medianScore = nationalScores.sort((a, b) => a - b)[Math.floor(nationalScores.length / 2)];
    if (best?.level === "bardzo_dobry" && medianScore >= 3) {
      const result: StoryResult = {
        sentence_pl: `${best.city} ma dziś wyjątkowo czyste powietrze — jeden z niewielu jasnych punktów w Polsce.`,
        sentence_en: `${best.city} has exceptionally clean air today — one of few bright spots in Poland.`,
        level: "bardzo_dobry",
        city: best.city,
      };
      return NextResponse.json(result);
    }

    // Rule 3: worst city PM2.5 significantly above typical
    if (worst?.level === "zly") {
      const result: StoryResult = {
        sentence_pl: `Wysokie stężenia smogu w ${worst.city}. Ogranicz aktywność na zewnątrz.`,
        sentence_en: `High smog levels in ${worst.city}. Limit outdoor activity today.`,
        level: "zly",
        city: worst.city,
      };
      return NextResponse.json(result);
    }

    // Rule 4: mostly good day
    const goodCount = cities.filter(c => ["bardzo_dobry", "dobry"].includes(c.level)).length;
    if (goodCount > cities.length * 0.6) {
      const result: StoryResult = {
        sentence_pl: `Dobry dzień na aktywność w Polsce. Większość miast — czyste powietrze.`,
        sentence_en: `A good day for outdoor activity across Poland. Most cities — clean air.`,
        level: "dobry",
        city: null,
      };
      return NextResponse.json(result);
    }

    // Rule 5: fallback
    const bad = cities.filter(c => ["zly", "bardzo_zly"].includes(c.level)).length;
    const result: StoryResult = {
      sentence_pl: `Polska dziś: ${goodCount} miast z dobrym powietrzem, ${bad} z przekroczeniami.`,
      sentence_en: `Poland today: ${goodCount} cities with clean air, ${bad} with exceedances.`,
      level: "umiarkowany",
      city: null,
    };
    return NextResponse.json(result);

  } catch {
    return NextResponse.json({
      sentence_pl: "Dane są chwilowo niedostępne.",
      sentence_en: "Data is temporarily unavailable.",
      level: "no_data" as AqiLevelKey,
      city: null,
    });
  }
}
```

2. Create `src/app/components/TodayStory.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";
import { getLevelConfig } from "@/lib/aqi-config";
import type { AqiLevelKey } from "@/lib/aqi-config";
import type { Lang } from "./LanguageSwitcher";

type StoryData = {
  sentence_pl: string;
  sentence_en: string;
  level: AqiLevelKey;
  city: string | null;
};

type Props = { lang: Lang };

export default function TodayStory({ lang }: Props) {
  const [story, setStory] = useState<StoryData | null>(null);

  useEffect(() => {
    fetch("/api/story/today")
      .then((r) => r.json())
      .then(setStory)
      .catch(() => {});
  }, []);

  if (!story) return null;

  const cfg = getLevelConfig(story.level);
  const sentence = lang === "pl" ? story.sentence_pl : story.sentence_en;

  // If story references a city, make that city name a navigation link
  let content: React.ReactNode = sentence;
  if (story.city) {
    const slug = story.city.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/ł/g, "l").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const parts = sentence.split(story.city);
    content = (
      <>
        {parts[0]}
        <a
          href={`/?city=${slug}`}
          style={{ color: cfg.color.primary, textDecoration: "underline", textDecorationStyle: "dotted", cursor: "pointer" }}
        >
          {story.city}
        </a>
        {parts.slice(1).join(story.city)}
      </>
    );
  }

  return (
    <div style={{
      padding: "10px 20px",
      background: cfg.color.bg,
      borderBottom: `1.5px solid ${cfg.color.border}`,
      display: "flex",
      alignItems: "center",
      gap: 10,
      flexShrink: 0,
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: "50%",
        background: cfg.color.primary, flexShrink: 0,
      }} />
      <span style={{ fontSize: 13, fontWeight: 500, color: cfg.color.text, lineHeight: 1.5 }}>
        {content}
      </span>
    </div>
  );
}
```

3. In `src/app/components/PageShell.tsx`: remove the national summary strip (the three worst/median/best cards). Replace it with `<TodayStory lang={lang} />` in the same position (between Navbar and the main map/panel area).

CONSTRAINTS:
- The story sentence must never exceed 100 characters — if the computed string is longer, truncate at the last word boundary before 100 chars and add "…"
- The city name link in `TodayStory` must use a plain `<a>` tag, not `next/link` — the city slug derivation matches `cityToSlug` in `localData.ts`
- `revalidate = 3600` on the API route — it must not be called on every page render
- When `data/local.db` does not exist, the API returns the fallback "Dane są chwilowo niedostępne" sentence gracefully

VERIFY:
```bash
npx tsc --noEmit
curl http://localhost:3000/api/story/today
# Expected: { sentence_pl: "...", sentence_en: "...", level: "...", city: "..." | null }
# Manual: the national summary strip (worst/median/best) is gone from the UI
# Manual: TodayStory renders with correct background colour from AQI level
```

COMMIT: `feat: replace national summary strip with TodayStory — generated sentence from live data`

---

### Step F0.2 — Add `DataFreshnessBanner` component

READS:
- `src/lib/types.ts` — `StationSummary`
- `docs/ui-component-reference.md` — section 1 design tokens

PRODUCES: `src/app/components/DataFreshnessBanner.tsx` (new file)

INSTRUCTIONS:

1. Create `src/app/components/DataFreshnessBanner.tsx`:

```tsx
// Shown above any component that displays potentially stale readings.
// Computes staleness from the most recent calc_date across all passed stations.
// Thresholds:
//   < 3h:  nothing rendered
//   3–12h: amber warning — "Data from Nh ago. Recommendations may not reflect current conditions."
//   > 12h: red warning — "Data too old to advise. Recommendations hidden."
//
// Also exports `isDataTooOld(stations)` — used by ContextActivityPanel to
// suppress activity recommendations when data is > 12h old.

import type { StationSummary } from "@/lib/types";
import type { Lang } from "./LanguageSwitcher";

type Props = {
  stations: StationSummary[];
  lang: Lang;
};

export function getDataAgeHours(stations: StationSummary[]): number | null {
  const dates = stations
    .map((s) => s.aqi.calc_date)
    .filter(Boolean)
    .map((d) => new Date(d!).getTime());
  if (dates.length === 0) return null;
  const newest = Math.max(...dates);
  return (Date.now() - newest) / 3600000;
}

export function isDataTooOld(stations: StationSummary[]): boolean {
  const age = getDataAgeHours(stations);
  return age !== null && age > 12;
}

export default function DataFreshnessBanner({ stations, lang }: Props) {
  const age = getDataAgeHours(stations);
  if (age === null || age < 3) return null;

  const tooOld = age > 12;
  const h = Math.floor(age);

  const bg     = tooOld ? "#FCEBEB" : "#FAEEDA";
  const border = tooOld ? "#F09595" : "#EF9F27";
  const text   = tooOld ? "#791F1F" : "#633806";

  const msg = tooOld
    ? (lang === "pl"
        ? `Dane mają ponad ${h}h. Zalecenia mogą być nieaktualne.`
        : `Data is over ${h}h old. Recommendations may be outdated.`)
    : (lang === "pl"
        ? `Dane sprzed ${h}h. Sprawdź ponownie za chwilę.`
        : `Data from ${h}h ago. Check again soon.`);

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "6px 12px",
      background: bg,
      border: `0.5px solid ${border}`,
      borderRadius: 8,
      fontSize: 11,
      color: text,
      marginBottom: 8,
    }}>
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
        <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2"/>
        <line x1="6" y1="3.5" x2="6" y2="6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        <circle cx="6" cy="8.5" r="0.7" fill="currentColor"/>
      </svg>
      {msg}
    </div>
  );
}
```

2. Add `<DataFreshnessBanner>` to:
   - `src/app/components/CityPanel.tsx` — above the `AqiDashboardCard`, passing `cityStations`
   - `src/app/components/StationCard.tsx` (F1.1) — below the AQI badge row, passing `[station]`

3. In `src/app/components/ContextActivityPanel.tsx` (F3.1): import `isDataTooOld` and when it returns `true`, replace the `<ActivityMatrix>` with:
```tsx
<div style={{ fontSize: 12, color: "#791F1F", background: "#FCEBEB", borderRadius: 8, padding: "10px 12px" }}>
  {lang === "pl"
    ? "Dane są zbyt stare, aby wyświetlić aktualne zalecenia."
    : "Data is too old to display current recommendations."}
</div>
```

CONSTRAINTS:
- `DataFreshnessBanner` returns `null` when age < 3h — no empty space rendered
- Do not show the banner when `calc_date` is null on all stations (treat as unknown, not stale)
- Age thresholds (3h, 12h) are hardcoded in this file — do not move them to `aqi-config.ts` (they are infrastructure constants, not domain constants)

VERIFY:
```bash
npx tsc --noEmit
# Expected: exit code 0
```

COMMIT: `feat: add DataFreshnessBanner — staleness indicator for all data-presenting components`

---

### Step F0.3 — Add `ShareButton` component

READS: `src/app/components/PageShell.tsx`

PRODUCES: `src/app/components/ShareButton.tsx` (new file)

INSTRUCTIONS:

1. Create `src/app/components/ShareButton.tsx`:

```tsx
"use client";
import { useState } from "react";
import type { Lang } from "./LanguageSwitcher";

type Props = {
  lang: Lang;
  // If provided, copies this URL. If not, copies window.location.href.
  url?: string;
};

export default function ShareButton({ lang, url }: Props) {
  const [copied, setCopied] = useState(false);

  function copy() {
    const target = url ?? window.location.href;
    navigator.clipboard.writeText(target).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      onClick={copy}
      title={lang === "pl" ? "Skopiuj link" : "Copy link"}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "4px 10px", fontSize: 11, fontWeight: 500,
        border: "0.5px solid var(--color-border-secondary)",
        borderRadius: 20, background: "transparent",
        color: copied ? "#0F6E56" : "var(--color-text-secondary)",
        cursor: "pointer", transition: "all 0.15s",
        borderColor: copied ? "#5DCAA5" : "var(--color-border-secondary)",
      }}
    >
      {copied ? (
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ) : (
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
          <path d="M8 1H3a1 1 0 00-1 1v7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          <rect x="4" y="3" width="6" height="8" rx="1" stroke="currentColor" strokeWidth="1.2"/>
        </svg>
      )}
      {copied
        ? (lang === "pl" ? "Skopiowano" : "Copied")
        : (lang === "pl" ? "Udostępnij" : "Share")}
    </button>
  );
}
```

2. Place `<ShareButton>` in:
   - `src/app/components/CityPanel.tsx` — in the panel header row, right-aligned next to the city name
   - `src/app/components/StationCard.tsx` (F1.1) — in the card header row, next to the close button
   - `src/app/timeline/page.tsx` (F5.3) — in the context header row, next to the back link

CONSTRAINTS:
- Uses `navigator.clipboard.writeText` only — no fallback document.execCommand (deprecated)
- No external share API, no modal — clipboard only
- The "Copied" state reverts after exactly 2000ms

VERIFY:
```bash
npx tsc --noEmit
# Expected: exit code 0
# Manual: clicking ShareButton copies URL and shows "Skopiowano" for 2 seconds
```

COMMIT: `feat: add ShareButton — clipboard share for city, station, and timeline views`

---

## PHASE F1 — Station card (revised from v1)

### Step F1.1 — Create `StationCard` component

READS:
- `src/lib/aqi-config.ts` — `getLevelConfig`, `giosLabelToKey`
- `src/app/components/AqiBadge.tsx`
- `src/app/components/DataFreshnessBanner.tsx`
- `src/app/components/ShareButton.tsx`
- `src/lib/types.ts` — `StationSummary`
- `docs/ui-component-reference.md` — design tokens

PRODUCES: `src/app/components/StationCard.tsx` (new file)

INSTRUCTIONS:

1. Props interface:

```tsx
type Props = {
  station: StationSummary;
  lang: Lang;
  onClose?: () => void;
};
```

2. Layout (top to bottom):

**Header band** (coloured with `cfg.color.bg`, border-bottom `cfg.color.border`):
- Row: station name (16px weight 500, `cfg.color.text`), right side: `<ShareButton>` + optional `×` close button
- Location line: `{station.city} · {station.district}` in 11px `cfg.color.text` opacity 0.7
- AQI badge row: `<AqiBadge>` left, relative time right ("2h temu", "< 1h temu")
- `<DataFreshnessBanner stations={[station]} lang={lang} />`

**Pollutant grid** (2-column grid, body padding):
- Render **only cells where the value is non-null**. If a station has only PM2.5 and PM10, render only those 2 cells.
- Each cell: value 20px weight 500 `var(--color-text-primary)`, label 10px secondary, unit 10px secondary.
- If fewer than 2 pollutants have data: render a single line "Stacja monitoruje tylko: {list}" in 11px secondary.
- Below the grid, if any pollutants are missing: add a 10px secondary note: `{N} wskaźników niedostępnych na tej stacji` / `{N} pollutants not monitored at this station`

**Mini trend area** — `<StationTrendMini>` placeholder div (height 96px), wired in F1.3.

**Action row** (flex, space-between):
- Left: `<SourceBadge source="gios" lang={lang} />`
- Right: coordinates in 10px secondary `{lat}°N {lon}°E`

**History button** — full-width ghost button: "Pełna historia →" / "Full history →", `href={"/timeline?context=station&station=" + station.id}`.

3. Card wrapper: `border-radius: 12px`, `border: 0.5px solid ${cfg.color.border}`, `overflow: hidden`, no outer padding (padding is in each section).

4. `relativeTime` helper same as v1.

CONSTRAINTS:
- Pollutant grid must not render `—` cells — cells with null values are omitted entirely
- `onClose` renders `×` only when defined — card is used both in panel and (future) as a standalone
- History button uses plain `<a>` tag until `/timeline` page exists
- No Tailwind classes

VERIFY:
```bash
npx tsc --noEmit
```

COMMIT: `feat: add StationCard — sparse-aware pollutant grid, freshness banner, share button`

---

### Step F1.2 — Wire `?station` URL param and map click to StationCard

READS:
- `src/app/components/PageShell.tsx`
- `src/app/components/StationCard.tsx`
- `src/lib/localData.ts` — `getStationById`
- `src/app/components/MapWrapper.tsx` — existing `onStationClick` prop (or add it)
- `AGENTS.md` — BUG-3 (fitBounds pattern)

PRODUCES: modified `src/app/components/PageShell.tsx`, modified `src/app/components/MapWrapper.tsx`

INSTRUCTIONS:

1. Add `onStationClick?: (stationId: string) => void` prop to `MapWrapper` and `PolandMap`. When a marker is clicked, call `onStationClick(station.id)`.

2. In `PageShell.tsx`:
   - Read `stationParam` from props (passed from `page.tsx` `searchParams.station`).
   - When `stationParam` is set: find the station via `allStations.find(s => s.id === stationParam)`.
   - The focus panel renders: breadcrumb → `<StationCard>` (replacing or stacking below `CityPanel` when a city is also selected).
   - Breadcrumb: `Polska → {cityName} → {station.name}` where each segment except the last is a link.
   - Map `fitBounds`: when station param is set, pass a single-item array `[{lat: station.lat, lon: station.lon}]` to a new `focusSingleStation` prop on MapWrapper that zooms to level 14.

3. In `MapWrapper`/`PolandMap`: on marker click, call `onStationClick` which in `PageShell` does:
   ```ts
   window.history.pushState({}, "", `/?station=${stationId}`);
   // then trigger a re-render by updating local state that PageShell reads
   ```
   Note: because PageShell is a client component and stationParam comes from the server, use `useSearchParams()` from `next/navigation` inside PageShell to read the live URL params. This is safe in a client component.

4. Breadcrumb "Polska" is hardcoded as `"Polska"` in both languages — it is a proper noun.

CONSTRAINTS:
- `router.push` must use `{ scroll: false }` — no scroll-to-top
- Do not break the existing city focus state — station is additive
- `fitBounds` for a single station uses `{ padding: [80, 80], maxZoom: 14 }` per BUG-3 pattern

VERIFY:
```bash
npx tsc --noEmit
# Manual: click a map marker → StationCard renders, URL updates to /?station=gios_N
# Manual: back button → URL returns to previous state
# Manual: /?city=krakow still works unchanged
```

COMMIT: `feat: wire map marker click to StationCard via ?station URL param`

---

### Step F1.3 — Create `StationTrendMini` and wire into StationCard

*(Identical to v1 F1.3 — no changes needed. Implement as specified there.)*

COMMIT: `feat: add StationTrendMini — 24h area chart in StationCard`

---

## PHASE F2 — Context metric cards (revised from v1)

### Step F2.1 — Create `MetricCard` component

*(Identical to v1 F2.1 — the p10/p90 range bar design is correct. Implement as specified there.)*

COMMIT: `feat: add MetricCard — current value with 12-month distribution range bar`

---

### Step F2.2 — Create context metrics API and `MetricCardRow` (revised)

READS:
- `src/app/components/MetricCard.tsx`
- `src/lib/localDb.ts`

PRODUCES:
- `src/app/api/metrics/context/route.ts` (revised — POST, not GET)
- `src/app/components/MetricCardRow.tsx`

INSTRUCTIONS:

1. The v1 API had station IDs in the query string. **This step replaces it with a POST endpoint** that accepts a JSON body:

```typescript
// POST /api/metrics/context
// Body: { scope: "city" | "station" | "national", city?: string, stationId?: string }
// Resolves station IDs server-side from SQLite.
// Returns aggregated current + annual distribution for PM2.5, PM10, NO2.

import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.resolve(process.cwd(), "data/local.db");
export const dynamic = "force-dynamic";

type PollutantKey = "pm25" | "pm10" | "no2";

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.max(0, Math.floor((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

export async function POST(req: Request): Promise<NextResponse> {
  const body = await req.json().catch(() => ({}));
  const { scope, city, stationId } = body as {
    scope: "city" | "station" | "national";
    city?: string;
    stationId?: string;
  };

  try {
    const db = new Database(DB_PATH, { readonly: true });
    const cutoffNow = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    const cutoff365 = new Date(Date.now() - 365 * 86400 * 1000).toISOString();

    // Resolve station IDs based on scope
    let stationIds: string[] = [];
    if (scope === "station" && stationId) {
      stationIds = [stationId];
    } else if (scope === "city" && city) {
      const rows = db.prepare(
        `SELECT id FROM stations WHERE lower(city) LIKE lower(?) AND is_active = 1`
      ).all(`%${city}%`) as { id: string }[];
      stationIds = rows.map(r => r.id);
    } else {
      // national
      const rows = db.prepare(`SELECT id FROM stations WHERE is_active = 1`).all() as { id: string }[];
      stationIds = rows.map(r => r.id);
    }

    if (stationIds.length === 0) {
      db.close();
      return NextResponse.json({ ok: true, metrics: {} });
    }

    const placeholders = stationIds.map(() => "?").join(",");
    const result: Record<PollutantKey, {
      currentValue: number | null; p10: number | null;
      p90: number | null; annualAvg: number | null; isCritical: boolean;
    }> = {
      pm25: { currentValue: null, p10: null, p90: null, annualAvg: null, isCritical: false },
      pm10: { currentValue: null, p10: null, p90: null, annualAvg: null, isCritical: false },
      no2:  { currentValue: null, p10: null, p90: null, annualAvg: null, isCritical: false },
    };

    for (const pol of ["pm25", "pm10", "no2"] as PollutantKey[]) {
      // Current: max (worst) across stations in last 3h
      const cur = db.prepare(
        `SELECT MAX(${pol}) AS val FROM readings WHERE station_id IN (${placeholders}) AND measured_at >= ?`
      ).get([...stationIds, cutoffNow]) as { val: number | null };

      // Annual distribution: daily averages, last 365 days
      const hist = db.prepare(`
        SELECT AVG(${pol}) AS day_avg
        FROM readings
        WHERE station_id IN (${placeholders}) AND measured_at >= ? AND ${pol} IS NOT NULL
        GROUP BY date(measured_at)
      `).all([...stationIds, cutoff365]) as { day_avg: number }[];

      const vals = hist.map(r => r.day_avg).sort((a, b) => a - b);

      if (vals.length >= 7) {
        const p10 = percentile(vals, 10);
        const p90 = percentile(vals, 90);
        const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
        const current = cur.val;
        result[pol] = {
          currentValue: current,
          p10: Math.round(p10 * 10) / 10,
          p90: Math.round(p90 * 10) / 10,
          annualAvg: Math.round(avg * 10) / 10,
          isCritical: current !== null && current > p90,
        };
      } else {
        result[pol] = { currentValue: cur.val, p10: null, p90: null, annualAvg: null, isCritical: false };
      }
    }

    db.close();
    return NextResponse.json({ ok: true, metrics: result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
```

2. `MetricCardRow` uses `fetch("/api/metrics/context", { method: "POST", body: JSON.stringify({ scope, city, stationId }) })`. Props:

```tsx
type Props = {
  scope: "city" | "station" | "national";
  city?: string;       // city display name (not slug)
  stationId?: string;
  contextLabel: string;
  lang: Lang;
};
```

3. Each `MetricCard` in the row also has an `onClick` handler that navigates to:
   `/timeline?context={scope}&city={citySlug}&pollutant={pm25|pm10|no2}`
   This is the "next step" from a metric card — clicking a card opens the timeline filtered to that pollutant.

CONSTRAINTS:
- SQL `IN (${placeholders})` uses parameterized values — the `pol` column name is validated against the `["pm25","pm10","no2"]` allowlist before interpolation
- Never pass station IDs from the client — always resolve server-side
- MetricCard `onClick` uses `window.location.href` not `next/link` (timeline page may not exist yet)

VERIFY:
```bash
npx tsc --noEmit
curl -X POST http://localhost:3000/api/metrics/context \
  -H "Content-Type: application/json" \
  -d '{"scope":"city","city":"Kraków"}'
# Expected: { ok: true, metrics: { pm25: {...}, pm10: {...}, no2: {...} } }
```

COMMIT: `feat: revised MetricCardRow — POST API, server-side station resolution, clickable cards`

---

## PHASE F3 — Context activity panel (revised from v1)

### Step F3.1 — Create `ContextActivityPanel` (with freshness guard)

READS:
- `src/app/components/ActivityMatrix.tsx`
- `src/app/components/DataFreshnessBanner.tsx` — `isDataTooOld`
- `src/lib/aqi-config.ts`
- `src/lib/types.ts`

PRODUCES: `src/app/components/ContextActivityPanel.tsx` (new file)

INSTRUCTIONS:

Same `worstLevel` logic as v1, with two additions:

1. Before rendering `<ActivityMatrix>`, call `isDataTooOld(stations)`. If true, render the stale-data message instead (as specified in F0.2 step 3).

2. Below the `<ActivityMatrix>`, add a "Dlaczego takie zalecenia?" / "Why these recommendations?" link:
```tsx
<a
  href="/timeline"
  style={{ fontSize: 11, color: "var(--color-text-secondary)", textDecoration: "underline",
    textDecorationStyle: "dotted", display: "block", marginTop: 10, textAlign: "right" }}
>
  {lang === "pl" ? "Skąd te zalecenia? →" : "Why these recommendations? →"}
</a>
```
This link routes to `/timeline` (the explanation of why air quality is what it is). It is the "next step" from the activity panel.

3. **Remove** the map bounding-box context-switching from v1 entirely. `ContextActivityPanel` responds only to the explicit `stations` prop — it does not listen to Leaflet events.

CONSTRAINTS:
- Cut all code related to Leaflet `moveend` events and bounding-box filtering — that feature is removed
- The "Skąd te zalecenia?" link must always be visible regardless of AQI level
- `isDataTooOld` is imported from `DataFreshnessBanner.tsx`, not re-implemented

VERIFY:
```bash
npx tsc --noEmit
```

COMMIT: `feat: add ContextActivityPanel — freshness guard, "why" link, no implicit zoom context`

---

## PHASE F4 — Pollutant band chart (revised from v1)

### Step F4.1 — Create `PollutantBandChart` (with gradient id fix and event markers)

READS:
- `src/lib/aqi-config.ts` — `BENCHMARKS`
- `src/data/timeline-events.json` (created in F5.1)
- `src/lib/types.ts` — `TimelineEvent`

PRODUCES:
- `src/app/api/station/[id]/history/route.ts` (identical to v1 — no changes)
- `src/app/components/PollutantBandChart.tsx` (revised)

INSTRUCTIONS:

Implement as v1 F4.1 with these three changes:

**Fix 1 — gradient id includes days:**
```tsx
// v1 (wrong):
<linearGradient id={`band-${stationId}`} ...>
// v2 (correct):
<linearGradient id={`band-${stationId}-${days}`} ...>
```
Also update `fill={`url(#band-${stationId}-${days})`}` everywhere the gradient is referenced.

**Fix 2 — event markers on the chart:**

Accept an optional `events` prop: `events?: TimelineEvent[]`. When provided and non-empty, render Recharts `ReferenceLine` components at each event date that falls within the current time window:

```tsx
{(events ?? [])
  .filter(e => {
    const d = new Date(e.date).getTime();
    const from = Date.now() - days * 86400 * 1000;
    return d >= from && d <= Date.now();
  })
  .map(e => (
    <ReferenceLine
      key={e.id}
      x={e.date}
      stroke="var(--color-text-tertiary)"
      strokeDasharray="2 4"
      strokeWidth={1}
      label={{
        value: "●",
        position: "top",
        fontSize: 8,
        fill: "var(--color-text-secondary)",
      }}
    />
  ))
}
```

Each marker dot is clickable (wrapped in a group with `onClick`) and scrolls the events list below the chart to the corresponding event card (using a shared `onEventClick: (eventId: string) => void` callback prop).

**Fix 3 — range selector adds "Wszystko" / "All" option:**
```tsx
const RANGE_OPTIONS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "1r", days: 365 },
] as const;
```
Keep as v1 — the "Wszystko" option is deferred until a future step when the DB has multi-year data.

CONSTRAINTS:
- Gradient id MUST include `days` — this is a regression fix, not optional
- `events` prop is optional — the chart must render correctly when `events` is undefined or empty
- `onEventClick` callback is optional — chart works without it

VERIFY:
```bash
npx tsc --noEmit
curl "http://localhost:3000/api/station/gios_400/history?days=30&pollutant=pm25"
# Expected: { ok: true, rows: [...] }
# Manual: change time range — chart colours update correctly (gradient not stale)
```

COMMIT: `feat: add PollutantBandChart — gradient fix, event markers, clickable spikes`

---

## PHASE F5 — Timeline page (substantially revised from v1)

### Step F5.1 — Create `src/data/timeline-events.json`

*(Identical to v1 F5.1 — 5 verified seed events. Implement as specified there.)*

COMMIT: `chore: add timeline-events.json — 5 verified Polish air quality events`

---

### Step F5.2 — Create `TimelineEvent` component (revised)

READS:
- `src/data/timeline-events.json`
- `src/lib/types.ts`

PRODUCES: `src/app/components/TimelineEvent.tsx` (new file)

INSTRUCTIONS:

Implement as v1 F5.2 with one addition: accept a `highlighted` prop and an `id` prop for scroll targeting:

```tsx
type Props = {
  event: TimelineEvent;
  lang: Lang;
  highlighted?: boolean;  // true when chart spike was clicked for this event
  id?: string;            // used for scrollIntoView from chart
};
```

When `highlighted === true`, add a left border accent:
```tsx
borderLeft: `3px solid ${s.border}`,
paddingLeft: 13, // compensate for border width
```

Also add a **"Pokaż na wykresie →"** / **"Show on chart →"** button inside each event card:
```tsx
<button
  onClick={() => onShowOnChart?.(event.date)}
  style={{
    fontSize: 11, color: s.text, opacity: 0.6,
    background: "none", border: "none", cursor: "pointer",
    padding: 0, marginTop: 6, textDecoration: "underline",
  }}
>
  {lang === "pl" ? "Pokaż na wykresie →" : "Show on chart →"}
</button>
```

Add `onShowOnChart?: (date: string) => void` to the Props type.

COMMIT: `feat: add TimelineEvent — highlight state, show-on-chart callback`

---

### Step F5.3 — Create the `/timeline` page (revised)

READS:
- All components from F4.1, F5.1, F5.2
- `src/app/components/Navbar.tsx`
- `src/app/components/Footer.tsx`
- `src/app/components/MetricCard.tsx`
- `src/app/components/ShareButton.tsx`
- `src/lib/localDb.ts`

PRODUCES: `src/app/timeline/page.tsx` (new file), `src/app/timeline/TimelineClient.tsx` (new file)

INSTRUCTIONS:

Split into server + client components to handle the interactive chart↔events connection.

1. `src/app/timeline/page.tsx` — server component:
   - Reads `searchParams`: `context`, `city`, `station`, `pollutant` (default `"pm25"`), `from`, `to`
   - Reads language from cookie `"powietrze_lang"`, falls back to `"pl"`
   - Loads `timeline-events.json` and filters by scope
   - Reads `getHarvestStats()` to get oldest available data date
   - Passes all data to `<TimelineClient>` as props
   - Renders `<Navbar>` and `<Footer>` around `<TimelineClient>`

2. `src/app/timeline/TimelineClient.tsx` — `"use client"` component:

   Layout (full-width, no map):
   
   **Context header row** (flex, space-between):
   - Left: breadcrumb `Polska → {city} → Historia` or `Polska → Historia`
   - Center: pollutant tab selector (PM2.5 | PM10 | NO₂) — `useState` drives the active pollutant
   - Right: `<ShareButton>` + back link `← Wróć` linking to `/?city={city}` or `/`

   **Metric summary** (3 MetricCards, `scope`/`city`/`stationId` passed to MetricCardRow):
   - These are the same cards from F2, here at full width

   **Band chart** (`<PollutantBandChart>`):
   - Full width (`width="100%"`, height 280px on desktop, 200px on mobile)
   - `events` prop receives the filtered `TimelineEvent[]` for this context
   - `onEventClick={(eventId) => setHighlightedEvent(eventId)}` — sets highlighted state in `TimelineClient`
   - Default range: 365 days

   **Events section**:
   - Heading: "Kluczowe wydarzenia" / "Key events" (15px weight 500)
   - `<TodayStory lang={lang} />` — yes, also on the timeline. The story sentence at top of events section contextualises what "today" means in historical terms.
   - Event cards in reverse-chronological order, each with `id={event.id}` and `highlighted={highlightedEvent === event.id}`
   - `onShowOnChart={(date) => { /* set chart range so that date is visible, scroll to chart */ }}` callback on each card

   **"Dlaczego powietrze w Polsce jest złe?"** — a collapsible section at the bottom:
   - Heading always visible, body collapsed by default
   - Body: 3 paragraphs of plain text (hardcoded, bilingual) covering: (1) coal heating dominance, (2) geography/inversions in Kraków, (3) EU directive trajectory. This is the "explanation layer" that answers the question every first-time user has. This content comes from `aqi-config-spec.md` section 4 contextual copy — do not invent new facts.
   - Below the body: `<ComplianceModal>` trigger button "Normy i limity →" / "Standards and limits →"

CONSTRAINTS:
- `TimelineClient` owns all interactive state: `highlightedEvent`, `activePollutant`, `chartRange`
- The chart↔events connection uses React state only — no DOM manipulation, no `document.getElementById`
- Scrolling to highlighted event: use `useRef` on the event list container + `element.scrollIntoView({ behavior: "smooth", block: "nearest" })`
- The "Dlaczego" section is `<details><summary>` — native HTML, no JavaScript needed for the collapse
- Language is read from cookie server-side and passed as a prop — no client-side `useLang` on this page

VERIFY:
```bash
npx tsc --noEmit
# Manual: /timeline renders with Navbar, chart, events list
# Manual: clicking a chart event marker highlights the correct event card and scrolls to it
# Manual: clicking "Pokaż na wykresie" on an event card updates the chart and scrolls up to it
# Manual: /timeline?context=city&city=krakow shows Kraków breadcrumb, Kraków events only + national
# Manual: back link returns to correct map URL
```

COMMIT: `feat: add /timeline page — bidirectional chart↔events, explanation section, share`

---

## PHASE F6 — City comparison (new in v2)

This phase was not in v1. It addresses the most common question a curious user has: "How does Kraków compare to Warsaw?"

### Step F6.1 — Create `ComparePanel` component and `?compare` URL param

READS:
- `src/app/components/PageShell.tsx`
- `src/app/components/MetricCard.tsx`
- `src/lib/localData.ts` — `getAllCities`, `getStationsByCity`
- `src/lib/types.ts`

PRODUCES:
- `src/app/components/ComparePanel.tsx` (new file)
- modified `src/app/components/PageShell.tsx`

INSTRUCTIONS:

1. Add `?compare=warszawa` URL param support to `PageShell`. When both `city` and `compare` params are set, render `<ComparePanel>` instead of `<CityPanel>` in the focus panel.

2. Create `src/app/components/ComparePanel.tsx`:

```tsx
// Side-by-side comparison of two cities.
// Shows: AQI badge, PM2.5/PM10/NO2 MetricCards, activity matrix for each city.
// Layout: two equal columns inside the 40% focus panel.

type Props = {
  cityASlug: string;
  cityAName: string;
  cityAStations: StationSummary[];
  cityBSlug: string;
  cityBName: string;
  cityBStations: StationSummary[];
  lang: Lang;
};
```

Layout (two columns, side by side, each column ~50% of the panel):

Each column contains (top to bottom):
- City name (14px weight 500) + `<AqiBadge>` for the city's worst level
- PM2.5 current value (24px weight 500, AQI-coloured) + "vs {other city}" delta in 11px secondary
  - If city A PM2.5 is 47 and city B is 22: city A shows "↑ 25 µg/m³ więcej niż {B}" in red-ish secondary; city B shows "↓ 25 µg/m³ mniej niż {A}" in green-ish secondary
- `<ActivityMatrix>` for the city's worst level (compact — 3-column grid instead of 5)
- "Pełna historia →" link to `/timeline?context=city&city={slug}`

Between the two columns: a thin `0.5px solid var(--color-border-tertiary)` vertical divider.

3. Add a "Porównaj z…" / "Compare with…" dropdown to `CityPanel` header. It shows a short list of major Polish cities. Selecting one updates the URL to `/?city={current}&compare={selected}`.

4. The map when compare mode is active: shows both cities' stations highlighted, others dimmed (opacity 0.3 on non-selected city markers).

CONSTRAINTS:
- The compact `ActivityMatrix` in compare mode uses a 3-column grid (running, cycling, kids_outside only) — the 5-activity grid is too wide for a half-panel
- Delta calculation uses the worst reading per city — same aggregation rule as everywhere else
- "Porównaj z…" dropdown lists at most 8 cities — the 8 most-monitored cities by station count

VERIFY:
```bash
npx tsc --noEmit
# Manual: /?city=krakow&compare=warszawa — ComparePanel renders with both cities
# Manual: compare delta shows correct positive/negative direction
# Manual: back to /?city=krakow dismisses compare mode
```

COMMIT: `feat: add ComparePanel — side-by-side city comparison with delta and activity matrix`

---

## PHASE F7 — "Pulse of the day" morning briefing strip (new in v2)

### Step F7.1 — Create `DayPulseStrip` component

READS:
- `src/app/components/ContextActivityPanel.tsx`
- `src/app/components/StationTrendMini.tsx`
- `src/lib/aqi-config.ts`
- `src/app/api/story/today/route.ts`

PRODUCES:
- `src/app/api/pulse/today/route.ts` (new file)
- `src/app/components/DayPulseStrip.tsx` (new file)
- modified `src/app/components/PageShell.tsx`

INSTRUCTIONS:

This is the "morning briefing" strip, shown on the main page when a city is focused. It answers three questions in a horizontal row of three cards:

**Card 1 — "Czy mogę biegać?"** / "Can I run?"
- Large icon: ✓ / ~ / ✗ (from activity matrix, `running` activity for current level)
- Label: "Bieganie" / "Running"
- Sub: the activity note from `aqi-config.ts` (e.g. "Max 30 min")

**Card 2 — "Jak dziś vs. ostatni miesiąc?"** / "Today vs. last month?"
- A `<StationTrendMini>` chart for the past 30 days with today's value annotated as a dot
- Sub: computed text: "Lepiej niż wczoraj" / "Gorzej niż tydzień temu" / "Typowy dzień"

**Card 3 — "Co powoduje zanieczyszczenie?"** / "What's causing it?"
- The critical pollutant name from the AQI index (PM2.5, PM10, etc.)
- One sentence from `aqi-config.ts` contextual copy explaining the source
- Link: "Czytaj więcej →" to `/timeline`

1. Create `src/app/api/pulse/today/route.ts`:

```typescript
// GET /api/pulse/today?city={slug}
// Returns the three-card data for DayPulseStrip for the specified city.
// Requires data/local.db.

import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";
import { giosLabelToKey, getLevelConfig, AQI_LEVEL_CONFIGS } from "@/lib/aqi-config";

const DB_PATH = path.resolve(process.cwd(), "data/local.db");
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city");
  if (!city) return NextResponse.json({ ok: false, error: "city required" }, { status: 400 });

  try {
    const db = new Database(DB_PATH, { readonly: true });

    // Get latest reading for this city
    const latest = db.prepare(`
      SELECT r.pm25, r.aqi_level, r.measured_at
      FROM readings r JOIN stations s ON r.station_id = s.id
      WHERE lower(s.city) LIKE lower(?) AND r.measured_at >= ?
      ORDER BY r.measured_at DESC LIMIT 1
    `).get(`%${city}%`, new Date(Date.now() - 3 * 3600 * 1000).toISOString()) as
      { pm25: number | null; aqi_level: string | null; measured_at: string } | undefined;

    // 30-day trend: daily avg PM2.5
    const trend = db.prepare(`
      SELECT date(measured_at) as date, AVG(pm25) as avg
      FROM readings r JOIN stations s ON r.station_id = s.id
      WHERE lower(s.city) LIKE lower(?) AND measured_at >= ? AND pm25 IS NOT NULL
      GROUP BY date(measured_at) ORDER BY date ASC
    `).all(`%${city}%`, new Date(Date.now() - 30 * 86400 * 1000).toISOString()) as
      { date: string; avg: number }[];

    db.close();

    const levelKey = giosLabelToKey(latest?.aqi_level ?? null);
    const cfg = levelKey !== "no_data" ? getLevelConfig(levelKey) : null;
    const runningActivity = cfg ? AQI_LEVEL_CONFIGS[levelKey]?.activities?.running : null;

    // Trend comparison
    const todayAvg = latest?.pm25 ?? null;
    const yesterday = trend[trend.length - 2]?.avg ?? null;
    const weekAgo = trend[Math.max(0, trend.length - 8)]?.avg ?? null;

    let trendLabel_pl = "Brak danych porównawczych";
    let trendLabel_en = "No comparison data";
    if (todayAvg !== null && yesterday !== null) {
      const diff = todayAvg - yesterday;
      if (diff < -2) { trendLabel_pl = "Lepiej niż wczoraj"; trendLabel_en = "Better than yesterday"; }
      else if (diff > 2) { trendLabel_pl = "Gorzej niż wczoraj"; trendLabel_en = "Worse than yesterday"; }
      else { trendLabel_pl = "Podobnie jak wczoraj"; trendLabel_en = "Similar to yesterday"; }
    }

    return NextResponse.json({
      ok: true,
      levelKey,
      runningState: runningActivity?.state ?? "no_data",
      runningNote_pl: runningActivity?.note_pl ?? null,
      runningNote_en: runningActivity?.note_en ?? null,
      trend: trend.map(t => ({ date: t.date, value: t.avg })),
      trendLabel_pl,
      trendLabel_en,
      pm25: todayAvg,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
```

2. Create `src/app/components/DayPulseStrip.tsx` — a `"use client"` component that fetches from `/api/pulse/today?city={citySlug}` and renders the three cards horizontally. Each card: `border-radius: 10px`, `background: var(--color-background-primary)`, `border: 0.5px solid var(--color-border-tertiary)`, `padding: 14px 16px`, equal flex.

3. In `PageShell.tsx`: render `<DayPulseStrip citySlug={cityParam} lang={lang} />` at the top of the city focus panel, before `<CityPanel>`.

CONSTRAINTS:
- All three cards must render in a single horizontal row — no wrapping on desktop
- On mobile: cards stack vertically (use `flexDirection: "column"`)
- Card 3 link "Czytaj więcej →" goes to `/timeline?context=city&city={citySlug}` — this is the narrative entry point from the morning briefing
- When `data/local.db` does not exist: render three skeleton placeholders with muted text "Brak danych"

VERIFY:
```bash
npx tsc --noEmit
curl "http://localhost:3000/api/pulse/today?city=Krak%C3%B3w"
# Expected: { ok: true, levelKey: "...", runningState: "...", trend: [...] }
# Manual: focus a city → DayPulseStrip renders three cards above CityPanel
```

COMMIT: `feat: add DayPulseStrip — morning briefing strip with run/trend/cause cards`

---

## SUMMARY OF ALL CHANGES FROM V1

### Removed from v1
- National summary strip (worst/median/best) → replaced by `TodayStory`
- Map bounding-box zoom → context switch on activity matrix → removed entirely
- GET `/api/metrics/context` with station IDs in query string → replaced by POST with scope/city

### Fixed from v1
- Gradient id in `PollutantBandChart` now includes `days` (SVG reuse bug)
- MetricCardRow API now resolves station IDs server-side (architectural fix)
- Pollutant grid in StationCard now omits null cells (sparse data fix)
- ContextActivityPanel now suppresses recommendations when data > 12h old

### Added in v2
- `TodayStory` — generated sentence from live data, city name is a nav link
- `DataFreshnessBanner` + `isDataTooOld` — staleness signalling everywhere
- `ShareButton` — clipboard share on city panel, station card, timeline
- `ComparePanel` + `?compare=` param — side-by-side city comparison
- `DayPulseStrip` — three-card morning briefing on city focus
- Event markers on `PollutantBandChart` — chart↔events bidirectional connection
- "Pokaż na wykresie →" on event cards — events drive chart range
- "Skąd te zalecenia?" link on activity panel → timeline
- "Dlaczego powietrze w Polsce jest złe?" collapsible explanation on timeline
- `onShowOnChart` / `onEventClick` state connection in `TimelineClient`

### New file summary

```
src/
  app/
    components/
      TodayStory.tsx           ← F0.1
      DataFreshnessBanner.tsx  ← F0.2
      ShareButton.tsx          ← F0.3
      StationCard.tsx          ← F1.1
      StationTrendMini.tsx     ← F1.3
      MetricCard.tsx           ← F2.1
      MetricCardRow.tsx        ← F2.2
      ContextActivityPanel.tsx ← F3.1
      PollutantBandChart.tsx   ← F4.1
      TimelineEvent.tsx        ← F5.2
      ComparePanel.tsx         ← F6.1
      DayPulseStrip.tsx        ← F7.1
    timeline/
      page.tsx                 ← F5.3
      TimelineClient.tsx       ← F5.3
    api/
      story/today/route.ts     ← F0.1
      station/[id]/trend/route.ts     ← F1.3
      station/[id]/history/route.ts   ← F4.1
      metrics/context/route.ts        ← F2.2
      pulse/today/route.ts            ← F7.1
  data/
    timeline-events.json       ← F5.1
```

### Execution order

F0.1 → F0.2 → F0.3 → F1.1 → F1.2 → F1.3 → F2.1 → F2.2 → F3.1 → F4.1 → F5.1 → F5.2 → F5.3 → F6.1 → F7.1

Phases F0 must complete before any F1+ step. F6 and F7 are independent of each other and may be developed in parallel after F5.
