---
paths:
  - "shared/faq/**/*.md"
---
- Required frontmatter: `title`, `sectionId`, `team`, `sourceUrl`, `retrievedAt`,
  `questions` (a YAML list of 1-3 realistic phrasings a student would actually type).
- The text that gets embedded for retrieval is `title + questions + body`, not just
  the body. A vague title with no question variants retrieves badly even when the
  answer itself is correct — this was the actual failure mode found and fixed
  during this build (see `docs/rag-build-summary.md`).
- Body: concise, bullet points for discrete facts/steps. No marketing filler, no
  dead anchor-only links, no undescribed embedded images.
- `team` must be one of the 8 current `SupportTeam` values (ADR 0003, including
  its amendment at the bottom — `ACADEMIC_SKILLS` no longer exists on its own).
- After adding or editing any file here, re-run `scripts/chunk-faq.mjs` onward
  (see "How to rebuild" in `docs/rag-build-summary.md`) so the live embeddings
  in Postgres stay in sync with the committed corpus.
