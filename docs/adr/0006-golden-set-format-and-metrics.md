# 0006: Golden set is JSONL with an explicit schema; the runner reports deterministic metrics

Status: Accepted
Date: 2026-11-18
Owner: Thomas

## Context

The evaluation harness is the core deliverable: a functional MVP whose value is the
evidence (eval, tests, progress metrics) around a deliberately simple agent, not a
perfect agent. The golden set is the artefact all of that rests on.

## Decision

Golden set lives at `eval/golden/*.jsonl`, one case per line. Start at 60 cases,
grow toward ~90. Per-case schema:

```
id, subject, body, lang_quality ("normal" | "poor_english"),
expected: {
  screening: { isSpam, isSensitive, isPromptInjectionAttempt, needsHumanReview },
  handoffReason: null | "sensitive" | "injection" | "urgent" | "uncertain_screening"
                 | "no_team" | "insufficient_faq",
  team: null | <SupportTeam>,
  outcome: "PUBLISHED_VIA_DRAFT" | "ESCALATED" | "DISCARDED" | "NEEDS_ASSIGNMENT"
},
notes
```

Team labels come from the `hub.json` leaf→team map (real ground truth). The runner
reports routing accuracy, per-flag precision/recall on screening, confusion on
outcome, latency p50/p95, and cost per ticket. Draft quality is handled separately
(see 0007).

## Alternatives considered

- One large JSON array — rejected: JSONL is easier to diff, append and stream.
- Invented team labels — rejected: labels anchored to `hub.json` make accuracy
  defensible to the marker.

## Consequences

Easier: every agent change produces a comparable, reproducible number. Harder: the
golden set must be built and maintained by hand; the "70% drafts accepted" metric is
not computable from a static set and is deferred to 0007.
