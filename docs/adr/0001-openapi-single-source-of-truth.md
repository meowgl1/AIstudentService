# 0001: OpenAPI is the single source of truth, with a top-level handoffReason enum

Status: Accepted
Date: 2026-11-18
Owner: Thomas

## Context

Two conflicting contract models existed: an earlier 12 Nov proposal (`handoff_reason`
enum + `needs_human` status) and the shape merged by Santiago in PR #1
(`needsHumanReview` boolean + an UPPERCASE status enum). `shared/` Zod types,
fixtures, the golden set and the eval runner all depend on one agreed shape.

## Decision

`docs/api/openapi.yaml` is the single source of truth; `shared/` aligns to it, not
the other way around. We keep the merged shape (`needsHumanReview` boolean + status
enum) and add an optional, nullable, top-level `handoffReason` field on `Ticket` with
a fixed enum, alongside the free-text `reason`. Value → state map:

| handoffReason | State set | Where |
|---|---|---|
| `sensitive` | ESCALATED | screening |
| `injection` | ESCALATED | screening |
| `urgent` | ESCALATED | screening |
| `uncertain_screening` | ESCALATED | screening |
| `no_team` | NEEDS_ASSIGNMENT | routing |
| `insufficient_faq` | ESCALATED | drafting |

## Alternatives considered

- Revert to the 12 Nov `handoff_reason` + `needs_human` model — rejected: it would
  undo an already-merged contract and break Santiago's status enum.
- Put `handoffReason` inside `ScreeningResult` — rejected: `no_team` and
  `insufficient_faq` are set after screening, so it must live on `Ticket`.

## Consequences

Easier: one measurable enum for the eval, set consistently across pipeline stages;
free-text `reason` kept for human-readable explanation. Harder: Santiago's agent
changes to `openapi.yaml` (Thomas's folder) now need Thomas's review, which already
happened once without it in PR #1.
