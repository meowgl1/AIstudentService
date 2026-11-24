// Ad-hoc smoke test for step 7's "done when" criterion (docs/rag-build-plan.md):
// embed a realistic student question with Voyage, then confirm pgvector's cosine `<=>`
// returns sensible top-4 nearest chunks. Not part of the pipeline - throwaway check.
//
// Usage: node --env-file=.env scripts/verify-retrieval.mjs "some question"

import pg from "pg";

const MODEL = "voyage-3.5-lite";
const question = process.argv[2] || "I forgot my password, how do I reset it?";

async function embed(text, apiKey) {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ input: [text], model: MODEL }),
  });
  if (!res.ok) throw new Error(`Voyage API error ${res.status}: ${await res.text()}`);
  const { data } = await res.json();
  return data[0].embedding;
}

async function main() {
  const embedding = await embed(question, process.env.VOYAGE_API_KEY);
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: true });
  await client.connect();

  const { rows } = await client.query(
    `SELECT section_id, team, title, source_url, 1 - (embedding <=> $1) AS cosine_similarity
     FROM faq_embeddings
     ORDER BY embedding <=> $1
     LIMIT 4`,
    [JSON.stringify(embedding)]
  );

  console.log(`Question: "${question}"\n`);
  rows.forEach((r, i) => {
    console.log(`${i + 1}. [${r.team}] ${r.title}  (similarity: ${r.cosine_similarity.toFixed(3)})`);
    console.log(`   ${r.source_url}`);
  });

  await client.end();
}

main();
