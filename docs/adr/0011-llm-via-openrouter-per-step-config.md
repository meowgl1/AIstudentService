# 0011: All LLM calls go through OpenRouter, model chosen per step by config

Status: Accepted
Date: 2026-11-18
Owner: Thomas

## Context

The pipeline makes four distinct LLM calls (screening, routing, drafting, judge) and we
want the model per step to be dynamic, extensible to cheaper models, and comparable
across providers. Cost per ticket is a reported eval metric, so model choice must be
easy to swap and measure.

## Decision

All LLM calls go through OpenRouter via a single OpenAI-compatible client. The model for
each step is an OpenRouter slug read from env, with a `shared/models.ts` registry.
Tiered defaults, with two alternatives each for provider comparison:

| Step | Default | Alt 1 | Alt 2 |
|---|---|---|---|
| Screening | `anthropic/claude-haiku-4.5` | `openai/gpt-5-mini` | `deepseek/deepseek-chat` |
| Routing | `anthropic/claude-haiku-4.5` | `openai/gpt-5-mini` | `deepseek/deepseek-chat` |
| Drafting | `anthropic/claude-sonnet-5` | `openai/gpt-5` | `deepseek/deepseek-chat` |
| Judge | `anthropic/claude-opus-4.8` | `openai/gpt-5` | `deepseek/deepseek-r1` |

Invariant: judge != drafter, always, validated by the eval. Cost per ticket is read from
OpenRouter's returned usage rather than a hand-maintained price table. Embeddings stay
Voyage-direct (OpenRouter does not serve them), so two keys: `OPENROUTER_API_KEY` +
`VOYAGE_API_KEY`. Non-Anthropic slugs/prices are confirmed at implementation.

## Alternatives considered

- Multiple provider SDKs (Vercel AI SDK with @ai-sdk/anthropic/openai/deepseek) —
  rejected once OpenRouter was chosen: one OpenAI-compatible client is simpler.
- A single strong model for every step — rejected: higher cost per ticket and a flatter
  efficiency story for the marker.
- Hand-maintained per-model price table — rejected: OpenRouter returns real cost.

## Consequences

Easier: swap a slug to compare providers on the same golden set; cost tracking is
accurate and survives model changes. Harder: a dependency on OpenRouter availability and
one indirection layer; embeddings remain a separate provider/key.
