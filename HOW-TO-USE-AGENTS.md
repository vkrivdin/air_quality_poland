# How to use an AI agent to build Powietrze

This works with Cursor, Claude Code, Perplexity Computer, GitHub Copilot, Gemini CLI, Windsurf, or any other agentic coding tool.

---

## Before you start — one-time setup checklist

`docs/build-plan.md` is complete. Before giving the agent any feature work, confirm these are done:

```bash
# 1. No stale delivery folders inside the project root
rm -rf changes_unpacked/ powietrze-changes.zip

# 2. Dependencies installed (node_modules must exist)
npm install

# 3. better-sqlite3 installed (required by localDb.ts and all new API routes)
npm install --save-exact better-sqlite3@9.4.3 @types/better-sqlite3@7.6.8

# 4. TypeScript clean on src/ only
npx tsc --noEmit 2>&1 | grep "^src/"
# Expected: no output (zero errors in src/)

# 5. local.db exists and has data
python3 -c "import sqlite3; c=sqlite3.connect('data/local.db'); print(c.execute('SELECT COUNT(*) FROM stations').fetchone())"
# Expected: (289,) or higher
```

None of these are the agent's job. Do them once manually before the first agent session.

---

## What to put in your repo root (already done)

```
AGENTS.md                        ← universal — every tool reads this
CLAUDE.md                        ← one line: points to AGENTS.md
GEMINI.md                        ← one line: points to AGENTS.md
.github/copilot-instructions.md  ← one line: points to AGENTS.md
.cursor/rules/powietrze.mdc      ← Cursor only — thin wrapper around AGENTS.md
```

All the substance is in `AGENTS.md`. The other files are one-liners that redirect tools which look for their own filename.

---

## How to give the agent a feature build task

Use **agent mode** (not chat mode). Agent mode can read files, run terminal commands, and verify output. Chat mode cannot.

Use a fresh conversation for each build step. Do not accumulate steps in one long conversation — context drift causes the agent to ignore earlier rules.

Give the agent this exact prompt, replacing F0.1 with the step you want:

```
Read docs/pre-build-notes.md before doing anything else.

Then execute step F0.1 from docs/feature-build-plan-v2.md.

Before writing any code:
- Read every file listed under READS in that step
- Read src/lib/aqi-config.ts
- Read docs/pre-build-notes.md sections relevant to this step

Produce only the files listed under PRODUCES.
Follow INSTRUCTIONS in order.
Check every CONSTRAINT.
Run every VERIFY command and confirm expected output.
Use the exact COMMIT string for the git commit message.
```

---

## Execution order for feature-build-plan-v2.md

Steps must be done in this order. Each depends on the previous.

```
F0.1 → F0.2 → F0.3   (foundation — must complete before anything else)
F1.1 → F1.2 → F1.3   (station card)
F2.1 → F2.2           (metric cards)
F3.1                   (context activity panel)
F4.1                   (band chart)
F5.1 → F5.2 → F5.3   (timeline)
F6.1                   (compare panel — independent, can run after F5)
F7.1                   (day pulse strip — independent, can run after F5)
```

F6 and F7 are independent of each other and can be run in any order after F5.3.

---

## After every step

1. Read the diff — confirm only files in PRODUCES were changed
2. Run `npx tsc --noEmit` — exit code must be 0
3. Run `npm run dev` — open the browser, confirm no visual regressions
4. Commit with the exact message from the build step
5. Start a fresh agent conversation for the next step

---

## Tool-specific notes

**Cursor** — use Agent mode (not Chat). The `.cursor/rules/powietrze.mdc` file loads automatically.

**Claude Code** — reads `CLAUDE.md` automatically, which points to `AGENTS.md`. Run `claude` in the project root.

**Perplexity Computer** — no auto-loading convention yet. Paste the contents of `AGENTS.md` as the first message, then give the step prompt.

**GitHub Copilot** — reads `.github/copilot-instructions.md` automatically in VS Code and JetBrains.

**Gemini CLI** — reads `GEMINI.md` automatically.

**Windsurf** — reads `AGENTS.md` automatically.

**Any other tool** — paste `AGENTS.md` contents manually as the first message if the tool does not auto-load it.

---

## The most important thing

Research shows that developer-written context files give a marginal positive effect, while overly long or LLM-generated files can hurt performance. The `AGENTS.md` in this project is intentionally short — it points to the docs rather than duplicating them. Do not expand it. If you want to add guidance, add it to the relevant doc file and add a pointer to that file in `AGENTS.md`.
