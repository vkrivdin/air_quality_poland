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

*(none yet — first promoted rule goes here)*
