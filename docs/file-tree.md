# Powietrze — Target File Tree
**Version:** 1.0 | **For:** LLM agents | **Last updated:** March 2026

This is the complete expected file tree after all phases of the build plan are complete. Agents use this to verify their output is in the correct location. Files marked `[exists]` are already present. Files marked `[new]` are created during the build. Files marked `[modified]` are changed. Files marked `[deleted]` are removed.

```
air_quality_poland/
│
├── docs/                                          [exists — do not modify]
│   ├── project-description.md                    [exists]
│   ├── working-agreement.md                      [exists]
│   ├── aqi-config-spec.md                        [exists — human reference]
│   ├── aqi-config.ts                             [exists — source to copy in Step 2.1]
│   ├── build-plan.md                             [exists — this plan]
│   ├── ui-component-reference.md                 [exists — component spec]
│   └── file-tree.md                              [exists — this file]
│
├── sql/
│   ├── 001_init_schema.sql                       [exists — do not modify]
│   └── 002_seed_krakow_demo.sql                  [modified — Step 0.2: Polish aqi_level strings]
│
├── scripts/
│   └── harvest-gios.py                           [exists — do not modify]
│
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── dev/
│   │   │   │   └── import-gios/
│   │   │   │       └── route.ts                  [exists — do not modify]
│   │   │   ├── health/
│   │   │   │   └── route.ts                      [exists — do not modify]
│   │   │   └── krakow/
│   │   │       ├── current/
│   │   │       │   └── route.ts                  [exists — do not modify until Supabase phase]
│   │   │       └── stations/
│   │   │           └── route.ts                  [exists — do not modify until Supabase phase]
│   │   │
│   │   ├── components/
│   │   │   ├── ActivityMatrix.tsx                [new — Step 3.1]
│   │   │   ├── AqiBadge.tsx                      [modified — Step 2.3: rewrite]
│   │   │   ├── AqiDashboardCard.tsx              [new — Step 3.4]
│   │   │   ├── ComplianceBadge.tsx               [new — Step 3.3]
│   │   │   ├── ComplianceModal.tsx               [new — Step 3.2]
│   │   │   ├── Footer.tsx                        [new — Step 8.1]
│   │   │   ├── LanguageSwitcher.tsx              [new — Step 2b.3]
│   │   │   ├── MapWrapper.tsx                    [exists — do not modify until Phase 5]
│   │   │   ├── Navbar.tsx                        [new — Step 2b.5]
│   │   │   ├── PolandMap.tsx                     [exists — do not modify until Phase 5]
│   │   │   ├── PolishFlagIcon.tsx                [new — Step 2b.2]
│   │   │   ├── PollutantChart.tsx                [new — Step 6.1]
│   │   │   ├── SeasonalCalendar.tsx              [new — Step 5.1]
│   │   │   ├── SourceBadge.tsx                   [new — Step 2b.4]
│   │   │   └── WarningBanner.tsx                 [new — Step 7.1]
│   │   │
│   │   ├── krakow/                               [deleted — Step 4b.2]
│   │   │   ├── KrakowMap.tsx                     [deleted]
│   │   │   └── page.tsx                          [deleted]
│   │   │
│   │   ├── favicon.ico                           [exists — do not modify]
│   │   ├── globals.css                           [modified — Step 2b.1: add Polish tokens]
│   │   ├── layout.tsx                            [exists — do not modify]
│   │   └── page.tsx                              [modified — Step 4.1: full replacement]
│   │
│   ├── data/
│   │   ├── krakow-readings.json                  [exists — do not modify]
│   │   └── stations-summary.json                 [exists — do not modify]
│   │
│   └── lib/
│       ├── aqi-config.ts                         [new — Step 2.1: copied from docs/]
│       ├── gios.ts                               [exists — do not modify]
│       ├── localData.ts                          [exists — do not modify]
│       ├── supabase.ts                           [exists — do not modify]
│       └── types.ts                              [modified — Step 2.2: remove AQI_LEVELS]
│
├── public/                                       [exists — do not modify]
│
├── .gitignore                                    [exists — do not modify]
├── .nvmrc                                        [exists — do not modify]
├── eslint.config.mjs                             [exists — do not modify]
├── next.config.ts                                [modified — Step 4b.1: add redirects]
├── package.json                                  [modified — Step 0.1: add recharts, d3]
├── package-lock.json                             [modified — Step 0.1: updated by npm]
├── postcss.config.mjs                            [exists — do not modify]
└── tsconfig.json                                 [exists — do not modify]
```

---

## Files an agent must NEVER modify unless a build step explicitly says to

- `src/lib/gios.ts`
- `src/lib/localData.ts`
- `src/lib/supabase.ts`
- `src/app/layout.tsx`
- `src/app/components/MapWrapper.tsx`
- `src/app/components/PolandMap.tsx`
- `src/data/*.json`
- `sql/001_init_schema.sql`
- `scripts/harvest-gios.py`
- `docs/aqi-config-spec.md`
- `docs/aqi-config.ts`
- `public/*`
- `.gitignore`, `.nvmrc`, `tsconfig.json`, `postcss.config.mjs`

---

## Files an agent must NEVER create

- Any file in `node_modules/`
- Any `.env` file (environment variables are set outside the repo)
- Any file not listed in this tree under `[new]` or `[modified]`

---

## Verification: count of components after all phases

```bash
ls src/app/components/ | wc -l
# Expected: 15
ls src/app/components/
# Expected: ActivityMatrix.tsx AqiBadge.tsx AqiDashboardCard.tsx
#           ComplianceBadge.tsx ComplianceModal.tsx Footer.tsx
#           LanguageSwitcher.tsx MapWrapper.tsx Navbar.tsx
#           PolandMap.tsx PolishFlagIcon.tsx PollutantChart.tsx
#           SeasonalCalendar.tsx SourceBadge.tsx WarningBanner.tsx
```
