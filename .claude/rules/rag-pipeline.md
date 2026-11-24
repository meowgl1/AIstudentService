---
paths:
  - "scripts/**/*.mjs"
  - "agent/src/**/*.ts"
  - "backend/migrations/**/*.sql"
---
- `scripts/*.mjs` are the one-off offline corpus builder (ADR 0009) — not a runtime
  component, no OpenRouter wiring belongs here. Only Voyage is called directly, for
  embeddings (ADR 0011).
- Pipeline order is fixed and each step reads only the previous step's output file:
  `scrape-pages.mjs` -> `extract-faq.mjs` -> `chunk-faq.mjs` -> `embed-chunks.mjs`
  -> `load-seed.mjs`. Don't reorder or skip a step when editing one of them.
- `faq_embeddings.content` is the full embedded text (title+questions+body, for
  search quality); `.body` is the clean answer alone (for citation excerpts shown
  to students). Don't collapse these back into one column — a prior version did
  that and excerpts came out unreadable (repeated title + question list before
  the actual answer).
- `agent/src/retriever.ts` only does the cosine-floor half of the insufficiency
  gate (ADR 0008). The LLM groundedness check on the drafted reply is a separate,
  not-yet-built step — don't add it here, it belongs to drafting.
- `DATABASE_URL` points at a Postgres shared with Leng's ticket-state tables.
  Coordinate before adding/renaming/dropping columns on `faq_embeddings`.
