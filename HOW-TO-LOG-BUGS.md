# How to log a bug and prevent it from ever recurring

Follow this process every time a bug is found and fixed. The goal is not to record history — it is to extract a rule that makes future agents incapable of making the same mistake.

---

## Step 1 — Fix the bug first

Fix the bug in the code. Get `npx tsc --noEmit` passing. Confirm the fix works.

---

## Step 2 — Ask the right question

Do not ask "what went wrong?" Ask: **"what design decision made this possible?"**

Examples of the right question:
- Not: "the agent hardcoded `#E24B4A` in a component" → "why was a hardcoded colour possible at all?"
- Not: "the agent used English strings in the DB seed" → "why was the string format ambiguous at the data boundary?"
- Not: "the component imported from types.ts instead of aqi-config.ts" → "why were two sources of truth available?"

The root cause is always one of these categories:
- **Missing constraint** — the rule didn't exist so the agent had to guess
- **Ambiguous source of truth** — two places had similar data and the agent chose the wrong one
- **Missing verification** — a check that would have caught the error before commit didn't exist
- **Scope creep** — the agent modified something outside PRODUCES for that step

---

## Step 3 — Write the BUGS.md entry

Open `BUGS.md`. Add a new entry at the bottom of the Entries section using the format:

```
### BUG-N — [short title]
**Date:** [today]
**Phase:** [e.g. Phase 0, Phase 3.1]
**Symptom:** [one sentence — what did you observe?]
**Root cause:** [one sentence — the design mistake category from Step 2]
**Fix:** [one sentence — what file changed and how]
**Principle:** [one imperative sentence an agent can follow — see format below]
**Added to AGENTS.md:** no
```

**How to write the principle:**

The principle must be:
1. Imperative ("Never...", "Always...", "Only X may...")
2. Specific enough to be followed without interpretation
3. About the class of problem, not the specific instance

Bad principle: "Don't hardcode colours"
Good principle: "Never write a hex colour value in a component file. All colours come from `getLevelConfig(key).color.*` or the three fixed sets: activity state colours, Polish identity colours, compliance severity colours — all defined in `src/lib/aqi-config.ts` or `docs/ui-component-reference.md` section 1."

Bad principle: "Check the DB seed file"
Good principle: "Any string written to the `aqi_level` column must be a Polish display string matching a key in `GIOS_LEVEL_NAME_MAP` from `src/lib/aqi-config.ts`. English strings ('good', 'moderate') are never valid values for this column."

---

## Step 4 — Decide: promote to AGENTS.md?

Ask: has this class of bug appeared before, or is it likely to appear again in a different form?

- If it appeared **once** and the fix is already enforced by TypeScript or a VERIFY command → leave it in BUGS.md only
- If it appeared **twice** or the principle cannot be machine-enforced → promote to AGENTS.md

To promote: add the principle to the relevant section of AGENTS.md under `## Hard-won rules`. Mark the BUGS.md entry as `**Added to AGENTS.md:** yes`.

---

## Step 5 — Commit both files together

```bash
git add BUGS.md AGENTS.md   # include AGENTS.md only if you promoted a principle
git commit -m "fix: [bug description] — add BUG-N to BUGS.md"
```

The bug fix, the BUGS.md entry, and any AGENTS.md update go in the same commit. They are one atomic action.

---

## What a mature BUGS.md looks like

After 10+ bugs, BUGS.md becomes a pattern library. Before starting a new build phase, an agent reads BUGS.md and internalises all principles before writing a line of code. The principles in AGENTS.md are the distilled version — the ones that proved their worth across multiple instances.

The distinction matters: BUGS.md is the full record with context. AGENTS.md is the short rule list the agent follows. Both serve different purposes. Neither replaces the other.
