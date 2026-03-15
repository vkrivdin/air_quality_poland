# BUGS.md — Powietrze bug ledger

This file records bugs that were found, fixed, and generalised into permanent rules.
It is a living document. Every entry follows the same structure.

**How to use this file:**
- When a bug is fixed, add an entry here immediately, in the same commit as the fix
- Extract the *design principle* — not just the fix — so the whole class of problem is prevented
- Keep each entry short: the principle is more important than the story
- When a principle is mature (seen twice), promote it to AGENTS.md

---

## Entry format

```
### BUG-N — Short title
**Date:** YYYY-MM-DD
**Phase:** which build phase this was caught in
**Symptom:** what the agent or developer observed
**Root cause:** the design mistake, not the surface error
**Fix:** what was changed
**Principle:** the rule that prevents this entire class of bug — written as a constraint an agent can follow
**Added to AGENTS.md:** yes / no / pending
```

---

## Entries

*(empty — first entry goes here when the first bug is found)*

---

## Promoted principles

Principles that have appeared in two or more bugs are promoted to AGENTS.md and marked here.

*(none yet)*
