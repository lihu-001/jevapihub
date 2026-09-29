import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { describe, expect, it } from "vitest";
import * as schema from "../../src/db/schema";
import { createHubService } from "../../src/lib/hub/service";
import { createInterfaceService } from "../../src/lib/interfaces/service";
import { manifest } from "../fixture";

describe("Interface Hub", () => {
  it("lists public versions only, filters tags, counts runs, and supports admin featured state", async () => {
    const client = new PGlite();
    try {
      for (const name of ["0000_foundation.sql", "0001_oauth_accounts.sql", "0002_ai_builder.sql", "0003_interface_hub.sql", "0004_admin_categories.sql"]) {
        await client.exec(readFileSync(`src/db/migrations/${name}`, "utf8"));
      }
      const db = drizzle(client, { schema });
      const [reader] = await db.insert(schema.users).values({ name: "Reader" }).returning();
      const [admin] = await db.insert(schema.users).values({ name: "Admin", role: "admin" }).returning();
      const cloud = createInterfaceService(db);
      const hub = createHubService(db);
      const publicManifest = structuredClone(manifest);
      publicManifest.metadata.tags = ["featured-topic"];
      const publicProject = await cloud.create(admin.id, publicManifest);
      const publicVersion = await cloud.publish(publicProject.id, admin.id, "public");
      const privateManifest = structuredClone(manifest);
      privateManifest.metadata.slug = "private-demo";
      const privateProject = await cloud.create(admin.id, privateManifest);
      await cloud.publish(privateProject.id, admin.id, "private");
      const unlistedManifest = structuredClone(manifest);
      unlistedManifest.metadata.slug = "unlisted-demo";
      const unlistedProject = await cloud.create(admin.id, unlistedManifest);
      await cloud.publish(unlistedProject.id, admin.id, "unlisted");
      expect((await hub.list()).map((card) => card.id)).toEqual([publicProject.id]);
      expect(await hub.list({ search: "not found" })).toEqual([]);
      expect(await hub.list({ search: "Demo", tag: "featured-topic" })).toHaveLength(1);
      expect(await hub.list({ tag: "other-topic" })).toEqual([]);
      expect(await hub.list({ category: "wrong" })).toEqual([]);
      expect(await hub.list({ language: "zh-CN" })).toHaveLength(1);
      await expect(hub.detail(admin.id, privateManifest.metadata.slug, reader.id)).rejects.toMatchObject({ status: 404 });
      expect((await hub.detail(admin.id, unlistedManifest.metadata.slug, null)).interface.id).toBe(unlistedProject.id);
      await db.insert(schema.runEvents).values({ interfaceId: publicProject.id, interfaceVersionId: publicVersion.id, success: true, latencyMs: 10 });
      await db.insert(schema.runEvents).values({ interfaceId: publicProject.id, interfaceVersionId: publicVersion.id, success: false, latencyMs: 10 });
      const listed = await hub.list({ sort: "runs" });
      expect(listed[0]).toMatchObject({ runCount: 1, versionNumber: 1, model: manifest.runtime.model });
      await expect(hub.setFeatured(publicProject.id, reader.id, true)).rejects.toMatchObject({ status: 403 });
      await hub.setFeatured(publicProject.id, admin.id, true);
      expect((await hub.list({ featured: true }))[0].featured).toBe(true);
    } finally { await client.close(); }
  });
});
