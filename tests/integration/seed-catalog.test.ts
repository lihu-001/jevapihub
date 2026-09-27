import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { parseManifest } from "../../src/lib/manifest/validate";
import { seedCatalog } from "../../scripts/seed-catalog.mjs";

describe("Official seed catalog", () => {
  it("publishes two valid immutable Manifest examples and remains idempotent", async () => {
    const client = new PGlite();
    try {
      for (const name of ["0000_foundation.sql", "0001_oauth_accounts.sql", "0002_ai_builder.sql", "0003_interface_hub.sql", "0004_admin_categories.sql"]) {
        await client.exec(readFileSync(`src/db/migrations/${name}`, "utf8"));
      }
      expect(await seedCatalog(client)).toEqual(["zh-article-template-tone", "creator-headline-score"]);
      expect(await seedCatalog(client)).toEqual([]);
      const versions = await client.query<{ manifest_json: unknown }>("SELECT manifest_json FROM interface_versions ORDER BY version_number");
      expect(versions.rows).toHaveLength(2);
      for (const version of versions.rows) expect(parseManifest(version.manifest_json).version).toBe(1);
      const listed = await client.query("SELECT id FROM interfaces WHERE status = 'published' AND visibility = 'public' AND featured = true");
      expect(listed.rows).toHaveLength(2);
    } finally { await client.close(); }
  });
});
