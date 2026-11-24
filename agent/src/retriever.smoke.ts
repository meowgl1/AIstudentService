// Smallest real check for retriever.ts's cosine-floor branch: one on-topic ticket must
// come back sufficient with the right team, one off-topic ticket must be gated out.
// Hits the real DB + Voyage API (no mocks set up in this project) - run manually, not
// part of an automated suite.
//
// Usage: node --env-file=.env --import tsx agent/src/retriever.smoke.ts
import assert from "node:assert/strict";
import pg from "pg";
import { retrieve } from "./retriever.ts";

async function main() {
  const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: true });

  const onTopic = await retrieve("I forgot my student email password, how do I reset it?", db);
  assert.equal(onTopic.sufficient, true, "expected the password-reset ticket to be sufficient");
  if (onTopic.sufficient) {
    assert.equal(onTopic.chunks.length > 0, true, "expected at least one chunk");
    assert.equal(onTopic.chunks[0].team, "IT_SUPPORT", `expected IT_SUPPORT, got ${onTopic.chunks[0].team}`);
  }
  console.log("PASS: on-topic ticket returned sufficient IT_SUPPORT chunks");

  const offTopic = await retrieve("what is the weather like in tokyo today", db);
  assert.equal(offTopic.sufficient, false, "expected the off-topic ticket to be gated as insufficient");
  if (!offTopic.sufficient) {
    assert.equal(offTopic.handoffReason, "insufficient_faq");
  }
  console.log("PASS: off-topic ticket correctly gated as insufficient_faq");

  await db.end();
  console.log("\nAll smoke checks passed.");
}

main();
