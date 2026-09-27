import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { describe, expect, it } from "vitest";
import * as schema from "../../src/db/schema";
import { createAdminService } from "../../src/lib/admin/service";
import { createHubService } from "../../src/lib/hub/service";
import { createInterfaceService } from "../../src/lib/interfaces/service";
import { manifest } from "../fixture";

describe("Admin catalog controls", () => {
  it("guards management, hides public Interfaces, restores them, and manages categories", async () => {
    const client = new PGlite();
    try {
      for (const name of ["0000_foundation.sql", "0001_oauth_accounts.sql", "0002_ai_builder.sql", "0003_interface_hub.sql", "0004_admin_categories.sql"]) {
        await client.exec(readFileSync(`src/db/migrations/${name}`, "utf8"));
      }
      const db = drizzle(client, { schema });
      const [owner] = await db.insert(schema.users).values({ name: "Owner" }).returning();
      const [adminUser] = await db.insert(schema.users).values({ name: "Admin", role: "admin" }).returning();
      const cloud = createInterfaceService(db);
      const hub = createHubService(db);
      const admin = createAdminService(db);
      const project = await cloud.create(owner.id, manifest);
      const version = await cloud.publish(project.id, owner.id, "public");
      await expect(admin.listInterfaces(owner.id)).rejects.toMatchObject({ status: 403 });
      await expect(admin.setHidden(project.id, owner.id, true)).rejects.toMatchObject({ status: 403 });
      expect(await admin.listInterfaces(adminUser.id)).toHaveLength(1);
      await admin.setHidden(project.id, adminUser.id, true);
      expect(await hub.list()).toHaveLength(0);
      await expect(hub.detail(owner.id, manifest.metadata.slug, null)).rejects.toMatchObject({ status: 404 });
      expect((await admin.listInterfaces(adminUser.id))[0].adminHidden).toBe(true);
      await admin.setHidden(project.id, adminUser.id, false);
      expect((await hub.list())[0].id).toBe(project.id);
      expect((await cloud.getVersion(project.id, version.id, null)).version.versionNumber).toBe(1);
      await expect(admin.upsertCategory(owner.id, { slug: "test-new", name: "Test", enabled: true, sortOrder: 5 })).rejects.toMatchObject({ status: 403 });
      await admin.upsertCategory(adminUser.id, { slug: "test-new", name: "测试", enabled: true, sortOrder: 5 });
      expect((await admin.categories(adminUser.id)).some((item) => item.slug === "test-new")).toBe(true);
      await admin.removeCategory(adminUser.id, "test-new");
      expect((await admin.categories(adminUser.id)).some((item) => item.slug === "test-new")).toBe(false);
      expect((await admin.overview(adminUser.id)).totalRuns).toBe(0);
    } finally { await client.close(); }
  });
});
