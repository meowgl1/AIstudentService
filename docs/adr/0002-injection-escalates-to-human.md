# 0002: Prompt injection escalates to a human, no AI draft

Status: Accepted
Date: 2026-11-18
Owner: Thomas

## Context

Ticket text is untrusted input. The merged contract only had a boolean
`ScreeningResult.isPromptInjectionAttempt` and no state transition, so a ticket
flagged as injection but not spam/sensitive would currently continue to ROUTING and
normal AI drafting with the flag merely set.

## Decision

An injection attempt always routes to a human: state ESCALATED, `handoffReason:
injection`, and the ticket text never reaches the drafting LLM.

## Alternatives considered

- Continue the normal pipeline with the flag set (current implicit behaviour) —
  rejected: lets manipulative input reach the drafter, the exact scenario to avoid.
- Discard it like spam (DISCARDED) — rejected: an injection can be embedded in a
  genuine student request, which would be lost.

## Consequences

Easier: strong "untrusted input, when in doubt a human decides" story for the
security report; keeps `injection` as a valid `handoffReason`. Harder: a legitimate
request wrapped in an injection pattern still waits for human review instead of an
auto-draft. Accepted tradeoff.
