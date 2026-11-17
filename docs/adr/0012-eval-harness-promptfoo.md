# 0012: The eval harness is promptfoo, not a hand-written runner

Status: Accepted
Date: 2026-11-18
Owner: Thomas

## Context

The eval is the core deliverable. Rather than hand-write a runner, an existing tool can
provide the model-comparison matrix, classification assertions, LLM-judge, cost/latency
reporting and CI. Evalite (the TypeScript option from Matt Pocock) was archived on
2026-11-09, so it is out.

## Decision

Use promptfoo as the harness. It natively provides the OpenRouter provider matrix (for
the 0011 comparison), `javascript`/`equals` assertions for screening and routing,
`llm-rubric` for draft quality with a judge model != drafter (0007), built-in cost and
latency reporting, a GitHub Action, and integrated red-teaming (useful evidence for the
injection theme, 0002). Structure: per-stage suites (screening, routing, draft) plus one
end-to-end suite via a promptfoo custom provider (a JS class exposing `callApi` that runs
the whole pipeline and returns `{ output, tokenUsage, cost }`). Golden set cases load
from the JSONL via a `tests: file://` loader. CI runs deterministic assertions + golden
set validation on every PR (no LLM calls, no secret, no cost); the full LLM eval runs
on-demand via `workflow_dispatch`, appending results to a committed history for the
progress trend.

## Alternatives considered

- Hand-written `eval/run.ts` — rejected: reinvents reporting, cost/latency aggregation
  and the provider matrix that promptfoo gives for free.
- DeepEval — rejected for now: heavier and Python-primary; its deep RAG metrics aren't
  needed since draft grounding is covered by a source-overlap assertion + `llm-rubric`.
- Evalite — rejected: archived 2026-11-09.

## Consequences

Easier: most of the measurement/comparison plumbing is free; LLM steps returning
structured JSON make assertions straightforward. Harder: the end-to-end custom provider
is the one non-trivial piece of glue; promptfoo is weak on RAG-specific metrics, so deep
retrieval analysis would need another tool later.
