import pg from "pg";
import { seedCatalog } from "./seed-catalog.mjs";

import { config } from "dotenv";

config({ quiet: true });

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const created = await seedCatalog(client);
  process.stdout.write(created.length ? `Created ${created.join(", ")}\n` : "Official catalog already seeded\n");
} finally {
  await client.end();
}
