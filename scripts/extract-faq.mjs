// One-off local extractor for the RAG corpus (ADR 0009, docs/rag-build-plan.md section 4).
// Reads scratch/raw/*.html (from scrape-pages.mjs), strips boilerplate with Readability,
// converts to markdown, splits by heading into sections, and writes one reviewable
// markdown doc per section to shared/faq/ with frontmatter (title, sectionId, team,
// sourceUrl, retrievedAt). Rules-based only — no LLM pass, per ADR 0009 ("LLM cleanup
// only if the raw output is messy"); run a manual review pass instead if needed.
//
// Usage: node scripts/extract-faq.mjs

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import assert from "node:assert/strict";
import path from "node:path";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import TurndownService from "turndown";

const RAW_DIR = path.resolve("scratch/raw");
const OUT_DIR = path.resolve("shared/faq");
const MIN_SECTION_CHARS = 40; // drop near-empty heading husks left after boilerplate strip

const turndown = new TurndownService({ headingStyle: "atx" });

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function pageSlugFromFilename(filename) {
  return filename.replace(/\.html$/, "");
}

// Markdown produced by Turndown with headingStyle "atx" always starts heading lines
// with one or more '#'. Split into [{ heading, body }], with heading "" for any lead
// content before the first heading.
function splitByHeading(markdown) {
  const lines = markdown.split("\n");
  const sections = [];
  let current = { heading: "", body: [] };
  for (const line of lines) {
    const match = /^#{1,6}\s+(.*)/.exec(line);
    if (match) {
      if (current.heading || current.body.some((l) => l.trim())) sections.push(current);
      current = { heading: match[1].trim(), body: [] };
    } else {
      current.body.push(line);
    }
  }
  if (current.heading || current.body.some((l) => l.trim())) sections.push(current);
  return sections.map((s) => ({ heading: s.heading, body: s.body.join("\n").trim() }));
}

function selfCheck() {
  assert.equal(slugify("APA Referencing (7th Edition)!"), "apa-referencing-7th-edition");
  const sections = splitByHeading("lead text\n\n# Heading One\nbody one\n\n## Heading Two\nbody two");
  assert.equal(sections.length, 3);
  assert.equal(sections[1].heading, "Heading One");
  assert.equal(sections[2].body, "body two");
}

async function extractOne(entry) {
  const raw = await readFile(path.join(RAW_DIR, entry.filename), "utf8");
  const dom = new JSDOM(raw, { url: entry.url });
  const article = new Readability(dom.window.document).parse();
  if (!article?.content) {
    console.log(`SKIP (readability found no article): ${entry.url}`);
    return [];
  }

  const markdown = turndown.turndown(article.content);
  const pageSlug = pageSlugFromFilename(entry.filename);
  const sections = splitByHeading(markdown);

  const docs = [];
  for (const { heading, body } of sections) {
    if (body.length < MIN_SECTION_CHARS) continue;
    const title = heading || article.title || pageSlug;
    const sectionId = `${pageSlug}--${slugify(heading || "overview")}`;
    docs.push({ sectionId, title, team: entry.team, sourceUrl: entry.url, retrievedAt: entry.retrievedAt, body });
  }
  return docs;
}

function toMarkdownFile(doc) {
  const frontmatter = [
    "---",
    `title: ${JSON.stringify(doc.title)}`,
    `sectionId: ${doc.sectionId}`,
    `team: ${doc.team}`,
    `sourceUrl: ${doc.sourceUrl}`,
    `retrievedAt: ${doc.retrievedAt}`,
    "---",
    "",
  ].join("\n");
  return `${frontmatter}${doc.body}\n`;
}

async function main() {
  selfCheck();
  await mkdir(OUT_DIR, { recursive: true });

  const manifest = JSON.parse(await readFile(path.join(RAW_DIR, "manifest.json"), "utf8"));
  const ok = manifest.filter((m) => m.status === "ok");

  let written = 0;
  const seenIds = new Set();
  for (const entry of ok) {
    const docs = await extractOne(entry);
    for (const doc of docs) {
      if (seenIds.has(doc.sectionId)) {
        console.log(`SKIP (duplicate sectionId): ${doc.sectionId}`);
        continue;
      }
      seenIds.add(doc.sectionId);
      await writeFile(path.join(OUT_DIR, `${doc.sectionId}.md`), toMarkdownFile(doc), "utf8");
      written += 1;
    }
    console.log(`${entry.url} -> ${docs.length} section(s)`);
  }

  console.log(`\nDone: ${written} FAQ docs written to ${OUT_DIR}`);
}

main();
