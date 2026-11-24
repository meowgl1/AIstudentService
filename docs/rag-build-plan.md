# RAG build plan — scrape Torrens pages and populate the knowledge base

Work plan for building the RAG corpus and retrieval, owned by Thomas (retrieval).
This is a plan, not code. Each section links the ADR that decided it, in
`docs/adr/`. Build the sections in order; most of the work is a one-off, offline,
local job (see ADR 0009).

Legend: **Done when** = the check that tells you the section is finished.

---

## 0. Prerequisites and scope

What to prepare before scraping anything.

- Environment: `VOYAGE_API_KEY` (embeddings), `DATABASE_URL` for the Render managed
  Postgres with the `pgvector` extension enabled. See ADR 0010, ADR 0011.
- TypeScript setup does not exist yet (`package.json` only has `mock-api` and
  `lint-api`). The builder is a local one-off script, so a minimal `tsx`/`ts-node`
  setup is enough; it does not need the full app build.
- Scope reminder: the RAG corpus is **real** scraped content; tickets stay synthetic.
  "Synthetic data only" was narrowed to tickets/PII. See ADR 0009.

**Done when:** keys resolve, `pgvector` is confirmed on the Render Postgres, and a
throwaway script can run locally in TypeScript.

Refs: ADR 0009, ADR 0010, ADR 0011.

---

## 1. Source inventory — decide which pages to scrape

Build the candidate list from real data, not guesswork.

- Parse `hub.json` (repo root, untracked). It is a JS dump: `helpTree` (9 categories)
  and `helpContacts` (real teams with channel/email), with the leading `const ... =`
  removed, so split the two objects to parse.
- Extract the real page URLs (the `url` fields, pointing at
  `studenthub.torrens.edu.au/Hub/...`) and the leaf -> team mapping.
- Curate a small list of pages that actually hold useful student content. This is a
  deliberate "evaluate which pages are useful" step, not a full-site crawl.

**Done when:** a reviewed list of candidate URLs exists, each tagged with its target
team from the `hub.json` leaf -> team map.

Refs: ADR 0009 (corpus source), ADR 0003 (team mapping is ground truth).

---

## 2. Probe — static HTML or JS-rendered?

Decide the scraping tool on evidence, not up front.

- Fetch one `studenthub.torrens.edu.au/Hub/...` page and check whether the content is
  already in the raw HTML or injected by JavaScript.
- Check `robots.txt`: respect default rules and the crawl-delay of 10 on
  `studenthub`. Use an honest, descriptive user-agent (no masking).

**Done when:** you know whether pages are static or JS-rendered, and which tool
section 3 will use.

Refs: ADR 0009.

---

## 3. Scrape — fetch the selected pages politely

- If static HTML: Node-native path, no paid service. Parse `sitemap.xml`, polite fetch
  honouring crawl-delay 10.
- If JS-rendered: use Firecrawl or Playwright, only because a plain fetch returns empty
  shells. Decision made on the probe result.
- Any URL that 302-redirects to login is public-only out of scope: drop it.
- Save raw pages to a scratch directory kept **out of git**.

**Done when:** the selected pages are fetched and stored locally, with source URL and
retrieval timestamp recorded per page.

Refs: ADR 0009.

---

## 4. Extract and refine — turn pages into clean FAQ docs

Rules first, LLM only if the raw is dirty.

- Strip boilerplate, extract the main content (e.g. `@mozilla/readability`), convert to
  markdown (e.g. `turndown`).
- Split by heading into sections. Assign `team` via the URL -> `hub.json` map.
- Write each doc to `shared/faq/*.md` with frontmatter: `title`, `sectionId` (stable
  slug, the citation anchor), `team`, `sourceUrl`, `retrievedAt`.
- An LLM cleanup pass is allowed only if the rules-based output is messy.

**Done when:** `shared/faq/*.md` contains clean, reviewable docs with complete
frontmatter, and the clean corpus is the artefact committed to git (raw HTML is not).

Refs: ADR 0009 (corpus + frontmatter), ADR 0001 (`sourceUrl` added to `Source`).

---

## 5. Chunk — split docs for retrieval

- One chunk per FAQ section; the entries are short. Split only long entries, roughly
  100-300 tokens, no elaborate overlap.
- Carry metadata on each chunk: `sectionId`, `team`, `title`, `sourceUrl`.

**Done when:** a deterministic chunk list is produced from `shared/faq/*.md` with
metadata intact.

Refs: ADR 0009 (chunking), ADR 0008 (retrieval consumes these chunks).

---

## 6. Embed — generate vectors offline

- Embed each chunk with Voyage `voyage-3.5-lite` (1024 dims). This runs once, offline,
  as part of the builder.
- Emit a committed seed artefact (chunks + precomputed embeddings) so the build is
  reproducible without re-calling the embedding API.
- The model is swappable: changing it means regenerating the seed and the vector
  dimension.

**Done when:** a committed seed file holds every chunk and its 1024-dim vector.

Refs: ADR 0010.

---

## 7. Store — pgvector schema and seed load

- Define the FAQ/embeddings table in the Render Postgres with a `vector(1024)` column.
- Load the seed from section 6 via a migration/seed step, so there is a single runtime
  store (no separate `vectors.json`).
- Coordinate migration ownership with Leng: this table is Thomas's (retrieval) but
  lives in the same Postgres as Leng's ticket-state tables.

**Done when:** the table exists in Postgres, is seeded, and a cosine `<=>` query
returns sensible nearest chunks.

Refs: ADR 0010.

---

## 8. Retriever — top-k with the insufficiency gate

- Retrieve `top-k = 4` by cosine `<=>`.
- Hybrid insufficiency gate: a cosine floor on the best chunk (discard "nothing
  relevant") plus an LLM groundedness check at draft time (discard "retrieved but
  doesn't answer").
- The threshold is a configurable env constant with a `ponytail:` comment; its real
  value is calibrated against the golden set in the prototype phase, not guessed.
- Bias toward escalation: on insufficient content, set `handoffReason: insufficient_faq`
  -> ESCALATED rather than draft an ungrounded reply.

**Done when:** the retriever returns top-4 chunks and correctly flags an insufficient
case as escalation on a few manual examples.

Refs: ADR 0008.

---

## 9. Contract — add sourceUrl to Source

- Add `sourceUrl` to the `Source` schema in `docs/api/openapi.yaml` so drafts cite the
  real page, not only `title`/`sectionId`/`excerpt`.
- `openapi.yaml` is the single source of truth; this is Thomas's folder.

**Done when:** `Source` carries `sourceUrl` and the contract lints clean.

Refs: ADR 0001.

---

## 10. What is committed vs scratch

- Committed to git: the clean corpus (`shared/faq/*.md`) and the seed (chunks +
  embeddings). These make the RAG build reproducible and reviewable.
- Not in git: raw scraped HTML (scratch directory).

Refs: ADR 0009, ADR 0010.

---

## Open items to resolve during the build

- Exact cosine floor threshold: calibrate in the prototype against the golden set
  (ADR 0008).
- Firecrawl vs Node: decided by the section 2 probe (ADR 0009).
- Migration ownership of the FAQ/embeddings table: align with Leng (ADR 0010).
- Voyage model/dimension confirmed at implementation (ADR 0010).
