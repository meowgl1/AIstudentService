# RAG corpus build — summary

Status: **steps 0-8 of `docs/rag-build-plan.md` are done.** This page is the actual
build record — what exists, how to rebuild it, and where it deviated from the plan.
Decisions with alternatives considered still live in `docs/adr/`; this page doesn't
repeat those, it just points to them.

## Pipeline, as actually built

| # | Step | Script | Output |
|---|---|---|---|
| 3 | Scrape | `scripts/scrape-pages.mjs` | `scratch/raw/*.html` + `manifest.json` (not in git) |
| 4 | Extract/refine | `scripts/extract-faq.mjs` | `shared/faq/*.md` (committed) |
| 5 | Chunk | `scripts/chunk-faq.mjs` | `scratch/chunks.json` (not in git) |
| 6 | Embed | `scripts/embed-chunks.mjs` | `shared/rag-seed.json` (committed) |
| 7 | Store | `scripts/load-seed.mjs` + `backend/migrations/0001_faq_embeddings.sql` | `faq_embeddings` table on Render Postgres |
| 8 | Retrieve | `agent/src/retriever.ts` | `retrieve(ticketText, db)` — top-4 + cosine-floor gate |

Current numbers: 34 pages scraped (32 auto + 2 pasted by hand) → 93 FAQ docs →
94 chunks → 94 embedded rows in `faq_embeddings` (`voyage-3.5-lite`, 1024 dims).

## How to rebuild from scratch

Needs `VOYAGE_API_KEY` and `DATABASE_URL` in `.env` (gitignored). Run in order:

```
node scripts/scrape-pages.mjs
node scripts/extract-faq.mjs
node scripts/chunk-faq.mjs
node --env-file=.env scripts/embed-chunks.mjs
node --env-file=.env scripts/load-seed.mjs
```

Each step is idempotent and reads only the previous step's output, so re-running after
editing `shared/faq/*.md` by hand just needs steps 5 onward.

## FAQ doc template (`shared/faq/*.md`)

Every doc needs this frontmatter, plus a clean, concise body:

```yaml
---
title: "Plain-text title, no embedded markdown"
sectionId: <stable-slug, doubles as citation anchor>
team: <one of the 8 SupportTeam values, see ADR 0003>
sourceUrl: <the real page this came from>
retrievedAt: <ISO timestamp>
questions:
  - "A question a student would actually type"
  - "An alternate phrasing of the same question"
---
Concise answer. Bullet points for discrete facts/steps. No marketing filler,
no dead links, no undescribed images.
```

Why `questions` matters: the text that gets embedded (and therefore matched against a
student's ticket) is `title + questions + body`, not just the body. A vague title with
no question variants retrieves badly even if the answer itself is correct — this was
the actual failure mode found and fixed in this build (see "Deviations" below).

Anyone adding FAQ content later (by hand or via a new scrape) must follow this
template, then re-run steps 5-7 above.

## Deviations from the original plan

- **`library.torrens.edu.au/home` dropped.** It's a promo/links widget that goes stale
  every trimester, not real content. Replaced with the 3 real sub-pages it links to
  (`getstarted`, `academicskills/apa/tool`, `genai`).
- **17 scholarship-card docs cut.** All were new/prospective-student marketing
  ("Enrolment status: New student" on every card), not support content for enrolled
  students. Only the category-index page survived.
- **`ACADEMIC_SKILLS` folded into `SUCCESS_COACH`; `LIBRARY_LEARNING` narrowed** to
  resource-finding only. `SupportTeam` is 8 values, not 9. See the amendment in
  `docs/adr/0003-support-teams-from-hub-json.md`.
- **`sourceUrl` added to `Source`** in `docs/api/openapi.yaml` — this was already
  decided (ADR 0001, ADR 0009) but not yet implemented before this build.
- **DB schema has both `body` and `content` columns**, not just one: `content` is
  title+questions+body (what's embedded, for search quality), `body` is the clean
  answer alone (what's shown as a citation excerpt). The plan didn't anticipate this
  split; it was needed once real excerpts turned out unreadable otherwise.
- **132 extracted docs → 93 committed.** ~39 had no real extractable/answerable
  content after cleanup (image-only sections, dead video pointers, legal boilerplate,
  stale dated calendar entries) and were deleted rather than kept as weak filler.

## Not done yet

- **Cosine-floor threshold is a placeholder** (`RAG_COSINE_FLOOR`, default 0.5, marked
  `ponytail:` in `retriever.ts`). Needs calibrating against the golden set once it
  exists (ADR 0008).
- **The LLM groundedness check** (the other half of the insufficiency gate) isn't
  built — it belongs to the drafting step, not the retriever.
- **Migration ownership with Leng** isn't formally coordinated yet; `faq_embeddings`
  is the only table in the shared Render Postgres so far.
