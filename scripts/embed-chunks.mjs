// One-off local embedder for the RAG corpus (ADR 0010, docs/rag-build-plan.md section 6).
// Reads scratch/chunks.json, calls Voyage (voyage-3.5-lite, 1024 dims) to embed each
// chunk's text, and writes the committed seed (chunks + vectors) that step 7 loads into
// pgvector. This is the only step that leaves the local machine - it calls Voyage's API
// - but the result is still written to disk/git here, not to the cloud Postgres yet.
//
// Requires VOYAGE_API_KEY. Usage: node --env-file=.env scripts/embed-chunks.mjs

import { readFile, writeFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import assert from "node:assert/strict";
import path from "node:path";

const CHUNKS_FILE = path.resolve("scratch/chunks.json");
const SEED_FILE = path.resolve("shared/rag-seed.json");
const MODEL = "voyage-3.5-lite"; // swap here + regenerate seed to change model/dims (ADR 0010)
const DIMENSIONS = 1024;
const BATCH_SIZE = 50; // well under Voyage's per-request limits for ~100-300 token chunks

function batch(items, size) {
  const groups = [];
  for (let i = 0; i < items.length; i += size) groups.push(items.slice(i, i + size));
  return groups;
}

function selfCheck() {
  assert.deepEqual(batch([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(batch([], 2), []);
}

// ponytail: accounts without a payment method get a reduced 3 RPM/10K TPM Voyage rate
// limit, not a billing error - retry with backoff instead of asking for a card.
async function embedBatch(texts, apiKey, attempt = 1) {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input: texts, model: MODEL }),
  });

  if (res.status === 429 && attempt <= 5) {
    const retryAfter = Number(res.headers.get("retry-after")) || 20;
    console.log(`Rate limited, waiting ${retryAfter}s (attempt ${attempt}/5)...`);
    await sleep(retryAfter * 1000);
    return embedBatch(texts, apiKey, attempt + 1);
  }
  if (!res.ok) {
    throw new Error(`Voyage API error ${res.status}: ${await res.text()}`);
  }
  const { data } = await res.json();
  return data.map((d) => d.embedding);
}

async function main() {
  selfCheck();

  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    console.error("VOYAGE_API_KEY is not set. Run with: node --env-file=.env scripts/embed-chunks.mjs");
    process.exit(1);
  }

  const chunks = JSON.parse(await readFile(CHUNKS_FILE, "utf8"));
  const batches = batch(chunks, BATCH_SIZE);
  const seed = [];

  for (const [i, group] of batches.entries()) {
    if (i > 0) await sleep(20_000); // stay under the reduced 3 RPM limit (no payment method on file)
    const embeddings = await embedBatch(group.map((c) => c.text), apiKey);
    assert.equal(embeddings.length, group.length, "Voyage returned a different count than requested");
    embeddings.forEach((embedding, j) => {
      assert.equal(embedding.length, DIMENSIONS, `expected ${DIMENSIONS} dims, got ${embedding.length}`);
      seed.push({ ...group[j], embedding });
    });
    console.log(`Embedded batch ${i + 1}/${batches.length} (${group.length} chunks)`);
  }

  await writeFile(SEED_FILE, JSON.stringify({ model: MODEL, dimensions: DIMENSIONS, chunks: seed }, null, 2));
  console.log(`\nDone: ${seed.length} embedded chunks -> ${SEED_FILE}`);
}

main();
