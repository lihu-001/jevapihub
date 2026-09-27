import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { describe, expect, it } from "vitest";
import * as schema from "../../src/db/schema";
import { ensureOAuthUser, findOAuthUser } from "../../src/lib/auth/accounts";
import { createInterfaceService } from "../../src/lib/interfaces/service";
import { manifest } from "../fixture";

async function database() {
  const client = new PGlite();
  await client.exec(readFileSync("src/db/migrations/0000_foundation.sql", "utf8"));
  await client.exec(readFileSync("src/db/migrations/0001_oauth_accounts.sql", "utf8"));
  return { client, db: drizzle(client, { schema }) };
}

describe("Cloud Interface service", () => {
  it("links OAuth identity without linking another provider by email", async () => {
    const { client, db } = await database();
    try {
      const id = await ensureOAuthUser(db, "github", "123", { name: "Alice", email: "alice@example.com" });
      expect(id).toBeTruthy();
      expect(await ensureOAuthUser(db, "github", "123", { name: "Changed" })).toBe(id);
      expect(await findOAuthUser(db, "github", "123")).toBe(id);
      expect(await ensureOAuthUser(db, "google", "other", { email: "alice@example.com" })).toBeNull();
      const rows = await db.select().from(schema.oauthAccounts);
      expect(rows).toHaveLength(1);
    } finally { await client.close(); }
  });

  it("keeps private Drafts owner-only and published versions immutable", async () => {
    const { client, db } = await database();
    try {
      const [owner] = await db.insert(schema.users).values({ name: "Owner" }).returning();
      const [other] = await db.insert(schema.users).values({ name: "Other" }).returning();
      const service = createInterfaceService(db);
      const project = await service.create(owner.id, manifest);
      await expect(service.read(project.id, other.id)).rejects.toMatchObject({ status: 404 });
      await expect(service.saveDraft(project.id, other.id, manifest)).rejects.toMatchObject({ status: 404 });
      const v1 = await service.publish(project.id, owner.id, "public");
      expect(v1.versionNumber).toBe(1);
      const changed = structuredClone(manifest);
      changed.metadata.name = "Updated draft";
      changed.questions.truth.instructions = "Different question";
      await service.saveDraft(project.id, owner.id, changed);
      const original = await service.getVersion(project.id, v1.id, other.id);
      expect(original.version.manifestJson.questions.truth.instructions).toBe("Is it true?");
      const v2 = await service.publish(project.id, owner.id, "private");
      expect(v2.versionNumber).toBe(2);
      expect(v2.manifestJson).toMatchObject({ version: 2 });
      await expect(service.getVersion(project.id, v1.id, other.id)).rejects.toMatchObject({ status: 404 });
      const history = await service.listVersions(project.id, owner.id);
      expect(history.map((version) => version.versionNumber)).toEqual([2, 1]);
      await expect(db.update(schema.interfaceVersions).set({ changelog: "mutated" })).rejects.toThrow();
      const stillOriginal = await service.getVersion(project.id, v1.id, owner.id);
      expect(stillOriginal.version.changelog).toBeNull();
    } finally { await client.close(); }
  });

  it("serves published public/unlisted versions and archives without deleting history", async () => {
    const { client, db } = await database();
    try {
      const [owner] = await db.insert(schema.users).values({ name: "Owner" }).returning();
      const service = createInterfaceService(db);
      const project = await service.create(owner.id, manifest);
      const version = await service.publish(project.id, owner.id, "unlisted");
      expect((await service.read(project.id, null)).draft).toBe(false);
      expect((await service.getVersion(project.id, version.id, null)).version.versionNumber).toBe(1);
      await service.archive(project.id, owner.id);
      await expect(service.read(project.id, null)).rejects.toMatchObject({ status: 404 });
      expect(await service.listVersions(project.id, owner.id)).toHaveLength(1);
    } finally { await client.close(); }
  });
});
