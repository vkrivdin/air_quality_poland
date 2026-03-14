# Powietrze — Working Agreement
**Version:** 1.1 | **Date:** March 2026 | **Status:** Active

This document defines how we work together on this project. It is a reference for both the developer and Claude. Read this at the start of every session.

---

## 1. Planning Rhythm

- Claude tells you **one step at a time**
- Each step includes a full explanation of *what* we're doing and *why* — no unexplained decisions
- Claude **proceeds automatically** if the step was already approved in the current plan
- Claude **waits for "go ahead"** if a step is new, unplanned, or involves a decision
- You can always say **"pause"** to stop and discuss before anything is executed

---

## 2. File & Code Changes

- Before writing or editing any file, Claude shows a **summary of what will change** — not the full file, but a clear description of additions, deletions, and modifications
- Claude **never writes more than one file at a time** without explicit approval
- Claude **never assumes a library is installed** — installation always comes before usage
- All code is written in **TypeScript** (never plain JavaScript)
- Every file Claude creates includes a **comment block at the top** explaining its purpose and role in the architecture

---

## 3. Action Markers

Every message from Claude that requires you to do something outside the conversation uses one of these clearly visible markers:

| Marker | Meaning |
|---|---|
| `▶ RUN THIS:` | A terminal command you need to execute |
| `📦 COMMIT NOW:` | A good point to commit — includes suggested message |
| `🔧 ACTION NEEDED:` | External action (sign up, configure, buy, register) |
| `💾 SAVE THIS:` | A file or document to save locally |
| `⚠️ NEVER COMMIT:` | A reminder that a specific file must stay out of Git |

These markers appear on their own line, never buried in a paragraph.

---

## 4. When Things Break

- If something doesn't work as expected, Claude **stops immediately and explains** what went wrong before proposing a fix
- Claude never silently tries multiple fixes — each attempt is explained and approved first
- Claude distinguishes between: **expected errors** (e.g. missing env variable on first run) vs **unexpected errors** (e.g. API returning a different shape than documented)

---

## 5. Dependency Management

### Core rules
- Always install packages with `--save-exact` to pin exact versions in `package.json`
- Always commit `package-lock.json` — this locks every sub-dependency exactly
- Never commit `node_modules/` — it is always in `.gitignore`
- A `.nvmrc` file in the project root documents the intended Node version (`22`)

### Installing packages
```bash
# Production dependency
npm install --save-exact <package-name>

# Dev-only dependency
npm install --save-exact --save-dev <package-name>
```

### Why this matters
Without `--save-exact`, `package.json` stores a range like `"^2.10.0"` which allows automatic minor/patch upgrades. This means two developers (or two deploys) can end up running different code. Exact pinning combined with `package-lock.json` guarantees everyone runs identical versions.

---

## 6. Git Conventions

### Commit frequency
Commit after every **working, testable state** — not just at the end of features. If we add a function and it runs without errors, that's a commit point.

### Commit message format
We use **Conventional Commits**:

```
<type>: <short description in English>

Types:
  feat:     a new feature or visible behaviour
  fix:      a bug fix
  chore:    setup, config, dependencies, tooling
  data:     data pipeline, schema, fetcher logic
  style:    UI/CSS changes only, no logic change
  refactor: code reorganisation, no behaviour change
  docs:     documentation, comments, README
```

### Examples
```
feat: add AQI colour indicator to Kraków dashboard
data: create readings table and station upsert logic
chore: initialise Next.js project with TypeScript and Tailwind
fix: handle null PM2.5 values from GIOŚ API response
docs: add data architecture section to README
```

### Branch strategy
- `main` — always deployable, never commit directly
- `develop` — integration branch, merge features here first
- `feature/<name>` — one branch per feature (e.g. `feature/kraków-dashboard`)
- `data/<name>` — for pipeline/schema work (e.g. `data/gios-fetcher`)

---

## 7. Code Conventions

| Convention | Rule |
|---|---|
| Language | TypeScript everywhere |
| Variable/function names | English |
| UI strings | Polish (default), English (translation) |
| Secrets | Always in `.env.local`, never hardcoded |
| Comments | English, explains *why* not *what* |
| File naming | `kebab-case` for files, `PascalCase` for components |
| Folder structure | Follows Next.js 14 App Router conventions |

---

## 8. Environment & Secrets

- All API keys and secrets live in `.env.local` at the project root
- `.env.local` is always in `.gitignore` — **never committed under any circumstance**
- A `.env.example` file is committed instead, with all variable names but empty values
- Claude will always remind you which variables need to be set before a step will work

```
# .env.example (committed to Git — safe)
GIOS_API_BASE_URL=
AIRLY_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

---

## 9. Definition of "Done" for Each Step

A step is considered done when:
1. The code runs without errors
2. The behaviour matches what was described in the plan
3. The change is committed to Git with a conventional commit message
4. Any new environment variables are documented in `.env.example`

---

## 9. Session Start Checklist

At the start of every working session, do this before anything else:

- [ ] Re-read the last section of the previous session's summary
- [ ] Check which branch you are on (`git branch`)
- [ ] Check for any uncommitted changes (`git status`)
- [ ] Confirm the dev server runs (`npm run dev`)
- [ ] Paste the **Resume Context** block (Section 10) if starting a new Claude conversation

---

## 10. How to Resume with Claude (New Conversation)

If this conversation is lost or you start a new one, paste this block to Claude to restore full context instantly. **Update the "Current status" line after each session.**

```
You are acting as an experienced software developer and data engineer helping me build a web app called Powietrze — an air quality visualisation app for Poland (focused on Kraków).

PROJECT SUMMARY:
- Next.js 14 (TypeScript) + Tailwind CSS frontend
- Next.js API routes as backend (no separate server)
- Supabase (PostgreSQL) for storing historical readings
- Vercel Cron Jobs for scheduled data fetching
- Data sources: GIOŚ API (official Polish gov) + Airly API (denser Kraków sensors)
- Charts: Recharts (standard) + D3.js (custom visuals)
- Map: Leaflet.js
- Deployed on Vercel (free tier)
- Polish-first UI, English as secondary language
- In-app AQI warnings only (no push/email)
- Desktop-first, works on mobile browser

WORKING AGREEMENT:
- One step at a time, full explanation of each decision
- Show summary/diff before writing files
- Proceed if step already approved, otherwise wait
- Stop and ask if something breaks unexpectedly
- Commit after every working/testable state
- Conventional commits (feat:, fix:, chore:, data:, etc.)
- TypeScript always, English for code, Polish for UI strings
- Use markers: ▶ RUN THIS / 📦 COMMIT NOW / 🔧 ACTION NEEDED / 💾 SAVE THIS / ⚠️ NEVER COMMIT

REFERENCE DOCUMENTS:
- project-description.md — full project spec
- working-agreement.md — this document

CURRENT STATUS:
[UPDATE THIS LINE — e.g. "Completed GIOŚ API exploration. Next step: set up Next.js project skeleton."]

Please confirm you understand and tell me the next step.
```

---

## 11. Project Phases (High Level)

For orientation — not a detailed plan, just the sequence of work ahead:

1. **API Exploration** — understand GIOŚ and Airly data shapes before writing any code
2. **Project Skeleton** — Next.js + TypeScript + Tailwind + Supabase + Git setup
3. **Database Schema** — finalise and create tables in Supabase
4. **Data Fetcher** — cron job that populates DB from both APIs
5. **Kraków Dashboard** — core page: current AQI, pollutant breakdown, in-app warnings
6. **Historical Charts** — time-series visualisations with Recharts + D3
7. **Poland Map** — interactive station map with Leaflet
8. **Station Comparison** — multi-station side-by-side view
9. **Language Switcher** — PL/EN toggle with full translations
10. **Polish & Deploy** — responsive layout, README, deploy to Vercel

---

*This document should be updated whenever we make a decision that changes how we work. Last updated: March 2026.*
