// One-off local chunker for the RAG corpus (ADR 0009, docs/rag-build-plan.md section 5).
// Reads shared/faq/*.md, builds the exact text that will be embedded in step 6
// (title + questions + body, so the natural-language question phrasings actually
// influence retrieval), and splits the rare long doc by paragraph with no overlap.
// Writes a deterministic, reproducible chunk list to scratch/chunks.json - not itself
// committed, since step 6 regenerates it and commits the final seed (chunks + vectors).
//
// Usage: node scripts/chunk-faq.mjs

import { readFile, writeFile, readdir } from "node:fs/promises";
import assert from "node:assert/strict";
import path from "node:path";

const FAQ_DIR = path.resolve("shared/faq");
const OUT_FILE = path.resolve("scratch/chunks.json");
const MAX_TOKENS = 300;
const CHARS_PER_TOKEN = 4; // rough estimate, consistent with the plan's "100-300 token" sizing

function estimateTokens(text) {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

// Parses our own fixed frontmatter shape (written by extract-faq.mjs / the FAQ rewrite
// pass): simple `key: value` lines plus one `questions:` YAML list. Not a general YAML
// parser - the format is fully under our control, so a regex-based reader is enough.
function parseFrontmatter(raw) {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw);
  if (!match) throw new Error("no frontmatter found");
  const [, fmBlock, body] = match;

  const frontmatter = { questions: [] };
  for (const line of fmBlock.split("\n")) {
    const listItem = /^\s*-\s+"(.*)"\s*$/.exec(line);
    if (listItem) {
      frontmatter.questions.push(listItem[1]);
      continue;
    }
    const kv = /^(\w+):\s*(.*)$/.exec(line);
    if (kv && kv[1] !== "questions") {
      const [, key, rawValue] = kv;
      frontmatter[key] = rawValue.replace(/^"(.*)"$/, "$1");
    }
  }
  return { frontmatter, body: body.trim() };
}

function buildEmbeddingText(frontmatter, body) {
  return [frontmatter.title, ...frontmatter.questions, body].join("\n");
}

// Greedy paragraph packing, no overlap (per ADR 0009: "no elaborate overlap").
function splitLongBody(body, maxTokens) {
  const paragraphs = body.split(/\n\n+/);
  const groups = [];
  let current = [];
  let currentTokens = 0;

  for (const para of paragraphs) {
    const paraTokens = estimateTokens(para);
    if (current.length && currentTokens + paraTokens > maxTokens) {
      groups.push(current.join("\n\n"));
      current = [];
      currentTokens = 0;
    }
    current.push(para);
    currentTokens += paraTokens;
  }
  if (current.length) groups.push(current.join("\n\n"));
  return groups;
}

function selfCheck() {
  const raw = [
    "---",
    'title: "Example title"',
    "sectionId: example--one",
    "team: STUDENT_SERVICES",
    "sourceUrl: https://example.com",
    "retrievedAt: 2026-01-01T00:00:00.000Z",
    "questions:",
    '  - "First question?"',
    '  - "Second question?"',
    "---",
    "Body text here.",
    "",
  ].join("\n");
  const { frontmatter, body } = parseFrontmatter(raw);
  assert.equal(frontmatter.title, "Example title");
  assert.deepEqual(frontmatter.questions, ["First question?", "Second question?"]);
  assert.equal(body, "Body text here.");

  const longBody = Array.from({ length: 5 }, (_, i) => `Paragraph ${i} `.repeat(20)).join("\n\n");
  const groups = splitLongBody(longBody, 30);
  assert.ok(groups.length > 1);
  assert.equal(groups.join("\n\n"), longBody);
}

async function main() {
  selfCheck();

  const files = (await readdir(FAQ_DIR)).filter((f) => f.endsWith(".md")).sort();
  const chunks = [];

  for (const file of files) {
    const raw = await readFile(path.join(FAQ_DIR, file), "utf8");
    const { frontmatter, body } = parseFrontmatter(raw);
    const { sectionId, team, title, sourceUrl } = frontmatter;

    const bodyTokens = estimateTokens(body);
    if (bodyTokens <= MAX_TOKENS) {
      // `text` is what gets embedded (title+questions+body, for search quality);
      // `body` is the clean answer alone, for showing as a citation excerpt.
      chunks.push({ sectionId, team, title, sourceUrl, text: buildEmbeddingText(frontmatter, body), body });
    } else {
      const parts = splitLongBody(body, MAX_TOKENS);
      console.log(`SPLIT (${bodyTokens} est. tokens -> ${parts.length} chunks): ${file}`);
      parts.forEach((part, i) => {
        chunks.push({
          sectionId: `${sectionId}--chunk-${i + 1}`,
          team,
          title,
          sourceUrl,
          text: buildEmbeddingText(frontmatter, part),
          body: part,
        });
      });
    }
  }

  await writeFile(OUT_FILE, JSON.stringify(chunks, null, 2));
  console.log(`\nDone: ${chunks.length} chunks from ${files.length} docs -> ${OUT_FILE}`);
}

main();
