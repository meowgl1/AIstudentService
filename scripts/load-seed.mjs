// One-off local loader for the RAG corpus (ADR 0010, docs/rag-build-plan.md section 7).
// Applies backend/migrations/0001_faq_embeddings.sql, then upserts every chunk from
// shared/rag-seed.json into pgvector on the managed Render Postgres. Idempotent - safe
// to re-run after regenerating the seed (e.g. a new model/dimensions, see embed-chunks.mjs).
//
// Requires DATABASE_URL. Usage: node --env-file=.env scripts/load-seed.mjs

import { readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const SEED_FILE = path.resolve("shared/rag-seed.json");
const MIGRATION_FILE = path.resolve("backend/migrations/0001_faq_embeddings.sql");

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set. Run with: node --env-file=.env scripts/load-seed.mjs");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: databaseUrl, ssl: true });
  await client.connect();

  try {
    const migration = await readFile(MIGRATION_FILE, "utf8");
    await client.query(migration);
    console.log("Migration applied (faq_embeddings table ready).");

    const seed = JSON.parse(await readFile(SEED_FILE, "utf8"));
    console.log(`Loading ${seed.chunks.length} chunks (model: ${seed.model}, dims: ${seed.dimensions})...`);

    for (const chunk of seed.chunks) {
      await client.query(
        `INSERT INTO faq_embeddings (section_id, team, title, source_url, body, content, embedding)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (section_id) DO UPDATE SET
           team = EXCLUDED.team,
           title = EXCLUDED.title,
           source_url = EXCLUDED.source_url,
           body = EXCLUDED.body,
           content = EXCLUDED.content,
           embedding = EXCLUDED.embedding`,
        [chunk.sectionId, chunk.team, chunk.title, chunk.sourceUrl, chunk.body, chunk.text, JSON.stringify(chunk.embedding)]
      );
    }

    const { rows } = await client.query("SELECT count(*) FROM faq_embeddings");
    console.log(`Done: faq_embeddings now has ${rows[0].count} rows.`);
  } finally {
    await client.end();
  }
}

main();
