import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set. Example: node --env-file=.env scripts/migrate.mjs");
  process.exit(1);
}

const ssl = process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false };
const client = new pg.Client({ connectionString: databaseUrl, ssl });
await client.connect();

try {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);

  const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../migrations");
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

  for (const filename of files) {
    const already = await client.query("SELECT 1 FROM schema_migrations WHERE filename = $1", [filename]);
    if (already.rowCount) {
      console.log(`skip ${filename}`);
      continue;
    }

    const sql = await fs.readFile(path.join(dir, filename), "utf8");
    console.log(`apply ${filename}`);
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations(filename) VALUES ($1)", [filename]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
  console.log("Migrations complete.");
} finally {
  await client.end();
}
