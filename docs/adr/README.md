# Architecture Decision Records (ADR)

This folder holds a short record for every significant technical decision on
this project. The point is simple: when someone asks "why did we do it this
way?" in three weeks, the answer is a file, not someone's memory.

## When to write one

Write an ADR when a decision is:
- Hard to reverse once built on (e.g. sync vs async pipeline, in-process vs
  separate service, state machine shape).
- Likely to be questioned later by a teammate, a marker, or future you.
- A tradeoff, not an obvious "only one way to do it" choice.

Don't write one for:
- Naming a variable, picking a folder name, formatting style.
- Anything already covered by `rules/` conventions or `CLAUDE.md`.
- Reversible day-to-day implementation details.

If in doubt, ask: "if this turns out wrong in a month, will we need to know
why we picked it?" If yes, write it down.

## Rules

- **One decision per file.** Don't bundle three unrelated choices into one
  ADR.
- **Number sequentially.** `0001-short-title.md`, `0002-short-title.md`,
  etc. Numbers are permanent, never reused.
- **Never edit an accepted ADR's decision after the fact.** If the decision
  changes, write a new ADR that supersedes the old one, and mark the old
  one's status as `Superseded by 000X`. The history should show that the
  team changed its mind, not pretend it always thought this.
- **Keep it short.** Half a page is normal. This is a record, not an essay.
- **Write it when the decision is made, not after the fact from memory.**
  Context fades fast.
- **Anyone can propose one, the person who owns the area approves it.**
  E.g. API/shared contracts → Thomas, frontend → James, backend/DB → Leng,
  agent/prompts → Santiago.

## Status lifecycle

```
Proposed -> Accepted -> (optionally) Superseded by 000X
                      -> (optionally) Deprecated
```

## File naming

```
0001-async-ticket-pipeline.md
0002-agent-in-process-module.md
0003-reject-escalates-to-human.md
```

## Template

Copy this into a new numbered file and fill it in.

```markdown
# 000X: <short decision title>

Status: Proposed | Accepted | Superseded by 000X | Deprecated
Date: YYYY-MM-DD
Owner: <name>

## Context

What problem are we solving? What constraints matter (team size, deadline,
stack, stretch vs MVP scope)?

## Decision

What did we decide, in one or two sentences?

## Alternatives considered

- Option A — why not chosen
- Option B — why not chosen

## Consequences

What does this make easier? What does it make harder or riskier? What do we
give up?
```
