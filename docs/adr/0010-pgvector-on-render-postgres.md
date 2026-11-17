# 0010: RAG retrieval uses pgvector on the managed Render Postgres, embeddings from Voyage

Status: Accepted
Date: 2026-11-18
Owner: Thomas (shared Postgres owned by Leng)

## Context

The corpus is small (~15-30 docs, ~50-150 chunks) and built offline (see 0009). top-k=4
is set (0008). The project deploys on Render with a managed Postgres that the backend
already uses, so a separate vector store or a committed `vectors.json` would mean two
stores for one job.

## Decision

Retrieval runs on pgvector in the managed Render Postgres (cosine via the `<=>`
operator, top-k=4). The offline builder emits a committed seed (chunks + precomputed
embeddings) that a migration/seed loads into pgvector, keeping "built once, committed,
reproducible" with a single runtime store. Embeddings use Voyage `voyage-3.5-lite`
(hosted, ~1024 dims → column `vector(1024)`); the model is swappable by regenerating the
seed. The FAQ/embeddings table is Thomas's (retrieval) but lives in the same Postgres as
Leng's ticket-state tables, so migration ownership must be aligned.

## Alternatives considered

- In-memory brute-force cosine with a committed `vectors.json` — rejected once a managed
  Postgres was confirmed: it would be a second store alongside the DB.
- A dedicated vector DB (Chroma, Pinecone) — rejected: a new service for a corpus that
  fits in one small table.
- Local MiniLM embeddings (`vector(384)`, zero cost) — kept as a fallback; Voyage chosen
  for better recall, which is a reported metric.

## Consequences

Easier: one data store, SQL-queryable, no extra infra. Harder: a shared Postgres means
Thomas and Leng must coordinate migrations; `voyage-3.5-lite` adds a `VOYAGE_API_KEY`
and a provider dependency (see 0011).
