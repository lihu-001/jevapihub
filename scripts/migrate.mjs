import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";
import { config } from "dotenv";
import { bootstrapAdmin } from "./bootstrap-admin.mjs";

config({ quiet: true });

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query("BEGIN");
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  const directory = join(process.cwd(), "src/db/migrations");
  for (const name of (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort()) {
    const sql = await readFile(join(directory, name), "utf8");
    const sha256 = createHash("sha256").update(sql).digest("hex");
    const existing = await client.query("SELECT sha256 FROM schema_migrations WHERE name = $1", [name]);
    if (existing.rows.length) {
      if (existing.rows[0].sha256 !== sha256) throw new Error(`Migration changed after apply: ${name}`);
      continue;
    }
    await client.query(sql);
    await client.query("INSERT INTO schema_migrations(name, sha256) VALUES ($1, $2)", [name, sha256]);
    process.stdout.write(`Applied ${name}\n`);
  }
  const admin = await bootstrapAdmin(client);
  await client.query("COMMIT");
  if (admin.created) {
    process.stdout.write(`Created admin account ${admin.email}\n`);
    if (admin.password) process.stdout.write(`Generated admin password: ${admin.password}\n`);
  } else process.stdout.write(`Admin account already exists: ${admin.email}\n`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
