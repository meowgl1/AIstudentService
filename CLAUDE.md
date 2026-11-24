# AIstudentService

ATW306 group project: AI-assisted student support ticket portal for Torrens students.

## Source of truth — read in this order

- `docs/adr/` — decisions already made. Treat these as rules, not suggestions.
  Changing one needs a dated amendment in the same file (see the one in
  `0003-support-teams-from-hub-json.md` for the pattern), never a silent
  contradiction elsewhere.
- `docs/api/openapi.yaml` — single source of truth for the API contract (ADR 0001).
  It's Thomas's folder; changes to it need his review.
- `docs/rag-build-plan.md` — the original plan for the RAG corpus. Not ground
  truth — it's what was *intended*, not necessarily what happened.
- `docs/rag-build-summary.md` — what was *actually* built, exact rebuild
  commands, and every deviation from the plan above. Check this before touching
  anything under `scripts/`, `shared/faq/`, or `agent/src/retriever.ts`.

## Commands

- Lint the API contract: `npm run lint-api`
- Typecheck: `npx tsc --noEmit`
- Retriever smoke test (hits the real DB + Voyage API):
  `node --env-file=.env --import tsx agent/src/retriever.smoke.ts`
- Rebuild the RAG corpus from scratch: see "How to rebuild" in
  `docs/rag-build-summary.md`

## Env vars (`.env`, gitignored)

- `VOYAGE_API_KEY` — embeddings. Voyage is called directly, not through
  OpenRouter (ADR 0011 — OpenRouter doesn't serve embeddings).
- `DATABASE_URL` — the shared Render Postgres (pgvector). Leng's ticket-state
  tables live in the same database; coordinate before changing schema there.

## Gotchas

- `shared/faq/*.md` frontmatter needs `questions` (a list of realistic student
  phrasings), not just a title. The embedded text is `title + questions + body`
  — a vague title with no question variants retrieves badly even when the
  answer itself is correct. Full template in `.claude/rules/faq-content.md`.
- `hub.json` (repo root) has real Torrens staff contact info and must never be
  committed — it's gitignored, keep it that way.
- The 9-team `SupportTeam` list in the original ADR 0003 is stale: it's 8 teams
  now (`ACADEMIC_SKILLS` folded into `SUCCESS_COACH`). Read the amendment at the
  bottom of that file, not just the top.
