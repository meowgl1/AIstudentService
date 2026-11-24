// RAG retriever (ADR 0008): top-k=4 over pgvector, gated by a cosine floor.
// This is HALF of the hybrid insufficiency gate - the other half (an LLM groundedness
// check on the drafted reply) belongs to the drafting step, not here. This module only
// decides "is there anything plausibly relevant at all" before a draft is even attempted.
import type { Pool } from "pg";

export interface RetrievedChunk {
  sectionId: string;
  team: string;
  title: string;
  sourceUrl: string;
  excerpt: string;
}

export type RetrievalResult =
  | { sufficient: true; chunks: RetrievedChunk[] }
  | { sufficient: false; handoffReason: "insufficient_faq" };

const TOP_K = 4;
const VOYAGE_MODEL = "voyage-3.5-lite";

// ponytail: provisional threshold. Calibrate against the golden set once it exists
// (ADR 0008) - this number is a placeholder, not a measured value.
const COSINE_FLOOR = Number(process.env.RAG_COSINE_FLOOR ?? "0.5");

interface FaqRow {
  section_id: string;
  team: string;
  title: string;
  source_url: string;
  body: string;
  similarity: number;
}

async function embed(text: string): Promise<number[]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) throw new Error("VOYAGE_API_KEY is not set");

  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ input: [text], model: VOYAGE_MODEL }),
  });
  if (!res.ok) {
    throw new Error(`Voyage API error ${res.status}: ${await res.text()}`);
  }
  const { data } = (await res.json()) as { data: { embedding: number[] }[] };
  return data[0].embedding;
}

export async function retrieve(ticketText: string, db: Pool): Promise<RetrievalResult> {
  const embedding = await embed(ticketText);

  const { rows } = await db.query<FaqRow>(
    `SELECT section_id, team, title, source_url, body,
            1 - (embedding <=> $1) AS similarity
     FROM faq_embeddings
     ORDER BY embedding <=> $1
     LIMIT $2`,
    [JSON.stringify(embedding), TOP_K]
  );

  if (rows.length === 0 || rows[0].similarity < COSINE_FLOOR) {
    return { sufficient: false, handoffReason: "insufficient_faq" };
  }

  return {
    sufficient: true,
    chunks: rows.map((r) => ({
      sectionId: r.section_id,
      team: r.team,
      title: r.title,
      sourceUrl: r.source_url,
      excerpt: r.body,
    })),
  };
}
