# Powietrze — Target File Tree
**Version:** 2.0 | **For:** LLM agents | **Last updated:** March 2026

This is the complete expected file tree. Files from `docs/build-plan.md` (Phases 0–8) are already complete and marked `[exists]`. Files from `docs/feature-build-plan-v2.md` are marked with their step reference. Agents use this to verify their output is in the correct location.

```
powietrze/
│
├── docs/                                                [exists — do not modify contents unless a step says to]
│   ├── project-description.md                          [exists]
│   ├── working-agreement.md                            [exists]
│   ├── aqi-config-spec.md                              [exists — human reference, do not modify]
│   ├── build-plan.md                                   [exists — COMPLETE, do not re-execute]
│   ├── feature-build-plan-v2.md                        [exists — active plan]
│   ├── local-data-collection-plan.md                   [exists]
│   ├── pre-build-notes.md                              [exists — read before any feature step]
│   ├── ui-component-reference.md                       [exists — component spec]
│   ├── file-tree.md                                    [exists — this file]
│   └── TESTING.md                                      [exists]
│
├── data/
│   ├── local.db                                        [exists — NEVER modify directly]
│   ├── harvest.log                                     [exists — written by harvest scripts only]
│   └── timeline-events.json                            [new — F5.1]
│
├── scripts/                                            [exists — do not modify any .py file during feature build]
│   ├── local-db/
│   │   ├── init.py                                     [exists]
│   │   └── schema.sql                                  [exists]
│   ├── db-summary.py                                   [exists]
│   ├── fetch-gios.ts                                   [exists]
│   ├── harvest-aqi-snapshot.py                         [exists]
│   ├── harvest-gios.py                                 [exists]
│   ├── harvest-readings.py                             [exists]
│   ├── harvest-sensors.py                              [exists]
│   └── harvest-stations.py                             [exists]
│
├── sql/
│   ├── 001_init_schema.sql                             [exists — do not modify]
│   └── 002_seed_krakow_demo.sql                        [exists]
│
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── cron/fetch-gios/route.ts                [exists — do not modify]
│   │   │   ├── dev/import-gios/route.ts                [exists — do not modify]
│   │   │   ├── health/route.ts                         [exists — do not modify]
│   │   │   ├── krakow/current/route.ts                 [exists — do not modify]
│   │   │   ├── krakow/stations/route.ts                [exists — do not modify]
│   │   │   ├── local/stats/route.ts                    [exists — from local-data-collection-plan H5.2]
│   │   │   ├── story/today/route.ts                    [new — F0.1]
│   │   │   ├── station/[id]/trend/route.ts             [new — F1.3]
│   │   │   ├── station/[id]/history/route.ts           [new — F4.1]
│   │   │   ├── metrics/context/route.ts                [new — F2.2]
│   │   │   └── pulse/today/route.ts                    [new — F7.1]
│   │   │
│   │   ├── components/
│   │   │   ├── ActivityMatrix.tsx                      [exists]
│   │   │   ├── AqiBadge.tsx                            [exists]
│   │   │   ├── AqiDashboardCard.tsx                    [exists]
│   │   │   ├── CityPanel.tsx                           [exists]
│   │   │   ├── CitySearch.tsx                          [exists]
│   │   │   ├── ComplianceBadge.tsx                     [exists]
│   │   │   ├── ComplianceModal.tsx                     [exists]
│   │   │   ├── ComparePanel.tsx                        [new — F6.1]
│   │   │   ├── ContextActivityPanel.tsx                [new — F3.1]
│   │   │   ├── DataFreshnessBanner.tsx                 [new — F0.2]
│   │   │   ├── DayPulseStrip.tsx                       [new — F7.1]
│   │   │   ├── Footer.tsx                              [exists]
│   │   │   ├── LanguageSwitcher.tsx                    [exists]
│   │   │   ├── MapWrapper.tsx                          [exists — modified in F1.2 to add onStationClick]
│   │   │   ├── MetricCard.tsx                          [new — F2.1]
│   │   │   ├── MetricCardRow.tsx                       [new — F2.2]
│   │   │   ├── Navbar.tsx                              [exists]
│   │   │   ├── PageShell.tsx                           [exists — modified in F0.1, F1.2, F7.1]
│   │   │   ├── PolandMap.tsx                           [exists — modified in F1.2 to add onStationClick]
│   │   │   ├── PolishFlagIcon.tsx                      [exists]
│   │   │   ├── PollutantBandChart.tsx                  [new — F4.1]
│   │   │   ├── PollutantChart.tsx                      [exists]
│   │   │   ├── SeasonalCalendar.tsx                    [exists]
│   │   │   ├── ShareButton.tsx                         [new — F0.3]
│   │   │   ├── SourceBadge.tsx                         [exists]
│   │   │   ├── StationCard.tsx                         [new — F1.1]
│   │   │   ├── StationTrendMini.tsx                    [new — F1.3]
│   │   │   ├── TimelineEvent.tsx                       [new — F5.2]
│   │   │   ├── TodayStory.tsx                          [new — F0.1]
│   │   │   └── WarningBanner.tsx                       [exists]
│   │   │
│   │   ├── timeline/
│   │   │   ├── page.tsx                                [new — F5.3]
│   │   │   └── TimelineClient.tsx                      [new — F5.3]
│   │   │
│   │   ├── favicon.ico                                 [exists — do not modify]
│   │   ├── globals.css                                 [exists]
│   │   ├── layout.tsx                                  [exists — do not modify]
│   │   └── page.tsx                                    [exists — modified in F0.1]
│   │
│   ├── data/
│   │   ├── krakow-readings.json                        [exists — do not modify]
│   │   └── stations-summary.json                       [exists — do not modify]
│   │
│   └── lib/
│       ├── aqi-config.ts                               [exists — do not modify]
│       ├── gios.ts                                     [exists — do not modify]
│       ├── localData.ts                                [exists — do not modify]
│       ├── localDb.ts                                  [exists — from local-data-collection-plan H5.1]
│       ├── supabase.ts                                 [exists — do not modify]
│       ├── supabaseData.ts                             [exists — do not modify]
│       └── types.ts                                    [exists — modified in F5.2 to add TimelineEvent type]
│
├── public/                                             [exists — do not modify]
│
├── .gitignore                                          [exists — do not modify]
├── .nvmrc                                              [exists — do not modify]
├── AGENTS.md                                           [exists]
├── BUGS.md                                             [exists]
├── CLAUDE.md                                           [exists]
├── GEMINI.md                                           [exists]
├── eslint.config.mjs                                   [exists — do not modify]
├── next.config.ts                                      [exists]
├── package.json                                        [exists]
├── package-lock.json                                   [exists]
├── postcss.config.mjs                                  [exists — do not modify]
└── tsconfig.json                                       [exists — do not modify]
```

---

## Files an agent must NEVER modify unless a build step explicitly says to

- `src/lib/aqi-config.ts`
- `src/lib/gios.ts`
- `src/lib/localData.ts`
- `src/lib/supabase.ts`
- `src/lib/supabaseData.ts`
- `src/app/layout.tsx`
- `src/data/*.json`
- `sql/001_init_schema.sql`
- `data/local.db`
- `data/harvest.log`
- `scripts/*.py`
- `docs/aqi-config-spec.md`
- `docs/build-plan.md`
- `public/*`
- `.gitignore`, `.nvmrc`, `tsconfig.json`, `postcss.config.mjs`

Note: `src/app/components/MapWrapper.tsx` and `src/app/components/PolandMap.tsx` are modified in Step F1.2 to add `onStationClick`. That is the only permitted modification — do not change anything else in those files.

---

## Files an agent must NEVER create

- Any file in `node_modules/`
- Any `.env` file (environment variables are set outside the repo)
- Any file not listed in this tree under `[new]` or `[modified]`
- `changes_unpacked/` or any staging/delivery directory inside the project

---

## Verification: component count after all feature phases

```bash
ls src/app/components/ | wc -l
# Expected: 30

ls src/app/components/
# Expected (alphabetical):
# ActivityMatrix.tsx      AqiBadge.tsx            AqiDashboardCard.tsx
# CityPanel.tsx           CitySearch.tsx          ComparePanel.tsx
# ComplianceBadge.tsx     ComplianceModal.tsx      ContextActivityPanel.tsx
# DataFreshnessBanner.tsx DayPulseStrip.tsx        Footer.tsx
# LanguageSwitcher.tsx    MapWrapper.tsx           MetricCard.tsx
# MetricCardRow.tsx       Navbar.tsx               PageShell.tsx
# PolandMap.tsx           PolishFlagIcon.tsx       PollutantBandChart.tsx
# PollutantChart.tsx      SeasonalCalendar.tsx     ShareButton.tsx
# SourceBadge.tsx         StationCard.tsx          StationTrendMini.tsx
# TimelineEvent.tsx       TodayStory.tsx           WarningBanner.tsx
```
