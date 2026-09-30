import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { bootstrapAdmin } from "../../scripts/bootstrap-admin.mjs";
import * as schema from "../../src/db/schema";
import { findPasswordUser } from "../../src/lib/auth/password";
import { drizzle } from "drizzle-orm/pglite";

async function database() {
  const client = new PGlite();
  for (const name of ["0000_foundation.sql", "0001_oauth_accounts.sql", "0002_ai_builder.sql", "0003_interface_hub.sql", "0004_admin_categories.sql", "0005_password_accounts.sql"]) {
    await client.exec(readFileSync(`src/db/migrations/${name}`, "utf8"));
  }
  return client;
}

describe("admin bootstrap", () => {
  it("creates an admin with a generated password once", async () => {
    const client = await database();
    try {
      const first = await bootstrapAdmin(client, { password: undefined });
      const second = await bootstrapAdmin(client, { password: undefined });
      expect(first.created).toBe(true);
      expect(first.password).toHaveLength(24);
      expect(second).toEqual({ email: first.email, password: null, created: false });
      const db = drizzle(client, { schema });
      expect(await findPasswordUser(db, first.email, first.password!)).toBeTruthy();
    } finally { await client.close(); }
  });

  it("uses a configured password and rejects a conflicting user", async () => {
    const client = await database();
    try {
      const first = await bootstrapAdmin(client, { password: "configured-password" });
      expect(first.password).toBeNull();
      await expect(bootstrapAdmin(client, { password: "another-password" })).resolves.toMatchObject({ created: false });
      const db = drizzle(client, { schema });
      expect(await findPasswordUser(db, first.email, "configured-password")).toBeTruthy();
    } finally { await client.close(); }
  });
});
