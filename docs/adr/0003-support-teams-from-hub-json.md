# 0003: SupportTeam is the real Torrens teams from hub.json; sensitive teams are out of routing

Status: Accepted
Date: 2026-11-18
Owner: Thomas

## Context

`SupportTeam` in the contract had 5 placeholder values (`ACADEMIC`, `IT`, `ADMIN`,
`FINANCE`, `STUDENT_SERVICES`). The project's problem is literally "requests reach the
wrong team", so the routing target must match the real Torrens support structure.
`hub.json` (captured from the real "I need help" page) gives 9 top-level categories
and the real teams with channel/email, including sensitive teams.

## Decision

`SupportTeam` is a curated subset of ~9 routable real teams derived from `hub.json`
contacts, with `STUDENT_SERVICES` as catch-all:

`STUDENT_SERVICES` · `STUDENT_FINANCE` · `ACADEMIC_SKILLS` · `LIBRARY_LEARNING` ·
`SUCCESS_COACH` · `ACCESSIBILITY` · `CAMPUS_LIFE` · `WIL_PLACEMENT` · `IT_SUPPORT`

Sensitive teams (Counselling, Safer Communities, Wellbeing) are **not** `SupportTeam`
values. They are reached only via screening `sensitive` → ESCALATED, never via agent
routing. Long-tail single-leaf teams (HDR, International Admissions, Nursing) fold into
the catch-all or an adjacent team to avoid fragmenting the golden set.

## Alternatives considered

- Keep the 5 synthetic placeholders — rejected: not the real structure, weak for the
  marker.
- Route on the 9 navigation categories — rejected: students write free text with no
  menu; the real routing target is the team/channel, not a nav category.
- Keep every real team including single-leaf ones — rejected: fragments a 50-100 case
  golden set and hurts the 90% accuracy target.

## Consequences

Easier: a clean 9-class routing problem with real labels, sensitive content never
touches the model. Harder: a folded long-tail team is a deliberate simplification; if
real volumes demand it, splitting a team out later is a rename + relabel, not a
redesign.
