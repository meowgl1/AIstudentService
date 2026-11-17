# 0004: Routing is an LLM classification on free text, guided by a hub.json rubric

Status: Accepted
Date: 2026-11-18
Owner: Santiago (draft), Thomas (approve)

## Context

On the real Torrens page a student clicks a category, but in our portal the student
writes free text (subject + body) with no menu. Routing must infer the team from text,
so a pure lookup is not enough. The leaf→team map in `hub.json` is data, not opinion.

## Decision

Routing is an LLM call that classifies subject + body into one of the 9 `SupportTeam`
values, guided by a concise rubric derived from `hub.json` (leaf titles become per-team
examples). The rubric lives versioned at `agent/prompts/rules/routing.v1.md`. The
`hub.json` leaf→team map is the ground truth for labelling the golden set and for the
rubric's few-shot examples. Santiago drafts the rubric, Thomas approves it;
confidence thresholds (when to send `no_team` → NEEDS_ASSIGNMENT instead of guessing)
are decided with Thomas.

## Alternatives considered

- Keyword/URL lookup — rejected: students don't paste leaf titles; free text needs
  inference.
- Fully Santiago-owned with no Thomas sign-off — rejected: routing accuracy is the
  metric Thomas measures in the eval, so it needs his approval.

## Consequences

Easier: a measurable 90% target against real `hub.json` labels, not invented ones.
Harder: the rubric must be maintained as teams/labels evolve; the agent folder is
shared, so the draft/approve boundary must be respected.
