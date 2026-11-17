# 0009: RAG corpus is built by a one-off offline scrape of real public Torrens pages

Status: Accepted
Date: 2026-11-18
Owner: Thomas

## Context

An earlier decision was "synthetic data only". For the RAG knowledge base that is too
weak: multiple public Torrens pages hold genuinely useful student content. `hub.json`
gives leaf titles and real URLs but not the page text. We have explicit permission to
scrape, and the project stays inside Torrens.

## Decision

The RAG corpus is real content scraped from public Torrens pages via a one-off,
offline, local process: search pages → evaluate which hold useful info → scrape →
extract only what's needed → refine → RAG. "Synthetic data only" narrows to tickets/PII;
it does not apply to the knowledge base — this ADR supersedes that scope for the corpus.
The builder is a local one-off script, not a runtime component. Tooling is decided by a
quick probe when built: Node-first by default (`sitemap.xml` → polite fetch respecting
crawl-delay 10 → `@mozilla/readability` → `turndown`), Firecrawl/Playwright only if the
pages are JS-rendered. Refinement is rules-first, LLM cleanup only if the raw is dirty.
The committed artefact is the clean corpus (`shared/faq/*.md` with frontmatter `title,
sectionId, team, sourceUrl, retrievedAt`); raw HTML stays out of git. `sourceUrl` is
added to `Source` in the OpenAPI so drafts cite the real page.

## Alternatives considered

- Hand-written synthetic FAQs anchored to `hub.json` — rejected by Thomas: real pages
  hold the useful content and we have permission.
- A paid scraping service (Firecrawl) by default — rejected: it's a one-off build of
  ~15-30 docs; add it only if a probe shows JS-rendered pages.
- Committing raw HTML — rejected: only the clean, reviewable corpus belongs in git.

## Consequences

Easier: a credible corpus coherent with routing labels and verifiable citations, built
once and committed for reproducibility. Harder: a manual curation/scrape step outside
CI; the corpus is a static committed artefact rather than a CI-rebuilt one.
