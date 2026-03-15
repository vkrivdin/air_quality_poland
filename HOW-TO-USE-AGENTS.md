# How to use an AI agent to build Powietrze

This works with Cursor, Claude Code, Perplexity Computer, GitHub Copilot, Gemini CLI, Windsurf, or any other agentic coding tool.

---

## What to put in your repo root (do this once)

```
AGENTS.md                        ← universal — every tool reads this
CLAUDE.md                        ← one line: points to AGENTS.md
GEMINI.md                        ← one line: points to AGENTS.md
.github/copilot-instructions.md  ← one line: points to AGENTS.md
.cursor/rules/powietrze.mdc      ← Cursor only — thin wrapper around AGENTS.md
```

All the substance is in `AGENTS.md`. The other files are one-liners that redirect tools which look for their own filename.

---

## What to put in docs/

```
docs/build-plan.md
docs/ui-component-reference.md
docs/file-tree.md
docs/aqi-config.ts
docs/aqi-config-spec.md
```

These already exist from the planning session. Do not modify them unless you are updating a decision.

---

## How to give the agent a task

Use **agent mode** (not chat mode) in whatever tool you are using. Agent mode can read files, run terminal commands, and verify output. Chat mode cannot.

Use a fresh conversation for each build step. Do not accumulate steps in one long conversation — context drift causes the agent to ignore earlier rules.

Give the agent this exact prompt, replacing N.N with the step number:

```
Execute build step N.N from docs/build-plan.md.

Before writing any code:
- Read every file listed under READS in that step
- Read src/lib/aqi-config.ts

Produce only the files listed under PRODUCES.
Follow INSTRUCTIONS in order.
Check every CONSTRAINT.
Run every VERIFY command and confirm expected output.
Use the exact COMMIT string for the git commit message.
```

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

**Any other tool** — paste `AGENTS.md` contents manually as the first message if the tool does not auto-load it. Every tool that can read files will find it at the project root.

---

## The most important thing

Research shows that developer-written context files give a marginal positive effect, while overly long or LLM-generated files can hurt performance. The `AGENTS.md` in this project is intentionally short — it points to the docs rather than duplicating them. Do not expand it. If you want to add guidance, add it to the relevant doc file and add a pointer to that file in `AGENTS.md`.
