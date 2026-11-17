# 0008: Retrieval is top-k=4 with a hybrid insufficiency gate biased toward escalation

Status: Accepted
Date: 2026-11-18
Owner: Thomas

## Context

The pipeline must decide when retrieved FAQ content is insufficient to draft, producing
`insufficient_faq` → ESCALATED. This gate is a trigger the golden set measures. A raw
similarity threshold is fragile and corpus-dependent; pure LLM self-evaluation is
non-deterministic.

## Decision

Hybrid, kept simple. `top-k = 4`. The gate combines a cosine floor on the best chunk
(discard "nothing relevant") with an LLM groundedness check at draft time (discard
"retrieved but doesn't answer"). The exact threshold is not guessed: it is calibrated
empirically against the golden set in the throwaway prototype, and lives in code as an
env-configurable constant with a `ponytail:` comment marking the provisional value. The
gate is deliberately asymmetric — tuned to prefer escalation over hallucination, since a
false "sufficient" (ungrounded draft) is worse than a false "insufficient" (goes to a
human).

## Alternatives considered

- Pure similarity threshold — rejected: fragile, corpus-dependent.
- Pure LLM self-evaluation — rejected: non-deterministic, no cheap pre-filter.

## Consequences

Easier: covers both RAG failure modes without complexity; a data-calibrated threshold
is defensible. Harder: the threshold needs the prototype phase to calibrate; the
escalation bias means more human handoffs, which is the intended safety tradeoff.
