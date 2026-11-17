# 0007: Draft quality is measured by an LLM judge anchored to a human sample; judge != drafter

Status: Accepted
Date: 2026-11-18
Owner: Thomas

## Context

"70% of drafts accepted with minor edits" is the one non-deterministic metric and needs
a judge. A static golden set cannot compute it. Judging faithfulness is itself a hard
task, so a weak judge produces noise.

## Decision

Primary automatic metric: an LLM-as-judge with a minimal 4-boolean rubric —
`grounded_in_sources`, `answers_question`, `no_unsupported_claims`, `tone_ok` — from
which an `acceptable` boolean is derived. It runs in the eval after each AI change. A
one-off human anchor: the group rates ~15 drafts with the same rubric and we report
judge-vs-human agreement (%). If agreement is low we declare the judge weak rather than
trust the number. The judge model is different from the drafting model to avoid
self-preference. "70%" becomes "% of drafts marked `acceptable` by the judge, validated
against a human sample".

## Alternatives considered

- Human-only rating — rejected: subjective, small N, not reproducible in the eval.
- LLM-judge only — rejected: self-preference bias, needs calibration.
- Source-overlap proxy only — rejected: no judgement of actual acceptability.

## Consequences

Easier: an automatic, repeatable quality number plus an honesty check. Harder: the
judge must stay on a strong paid model (not downgraded to save cost), and the human
anchor is manual work.
