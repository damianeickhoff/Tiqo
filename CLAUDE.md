# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

# Tiqo conventions

Project rules, not general coding advice. These are decisions already made; follow them rather than re-deciding.

## Edits are drafted and saved, never live

**An edit is not written to the database until someone presses Save.**

Typing in a field, choosing from a dropdown or ticking a box inside an editor changes a _draft_. The draft is committed by an explicit Save, and abandoned by Cancel. Never save on blur, on change, or on toggle.

Why: saving as you type gives no moment to change your mind, no way to abandon a half-finished edit, and no signal that anything was stored. It also makes every field its own round trip, so a form reads as a series of unrelated writes rather than one decision.

Applies to: forms, inspectors, editors and settings panels — everything where someone is _describing_ something.

Does **not** apply to list-level commands, which are their own decision and take effect immediately:

- add, delete, duplicate
- reorder (move up/down)
- publish / hide, feature / unfeature from a list row

The test: if it has a text field next to it, it belongs to a draft. If it is a verb on its own, it happens now.

A Save control must show that it has something to save (enabled only when dirty), and confirm when it has saved.
