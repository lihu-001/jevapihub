import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as schema from "../../src/db/schema";
import { manifest } from "../fixture";

const holder = vi.hoisted(() => ({ db: null as unknown, viewer: null as string | null }));
vi.mock("../../src/db/database", () => ({ getDatabase: () => holder.db }));
vi.mock("../../src/lib/auth/current-user", () => ({ getCurrentUserId: async () => holder.viewer }));

import { POST as generate } from "../../src/app/api/ai-builder/generate/route";
import { POST as refine } from "../../src/app/api/ai-builder/refine/route";
import { createInterfaceService } from "../../src/lib/interfaces/service";

function request(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

afterEach(() => {
  holder.db = null;
  holder.viewer = null;
  delete process.env.AI_BUILDER_API_KEY;
  delete process.env.AI_BUILDER_DAILY_LIMIT;
  delete process.env.AI_BUILDER_ENABLED;
  vi.unstubAllGlobals();
});

describe("AI Builder HTTP API", () => {
  it("requires login, enforces daily quota, and never changes a published version", async () => {
    const client = new PGlite();
    try {
      await client.exec(readFileSync("src/db/migrations/0000_foundation.sql", "utf8"));
      await client.exec(readFileSync("src/db/migrations/0001_oauth_accounts.sql", "utf8"));
      await client.exec(readFileSync("src/db/migrations/0002_ai_builder.sql", "utf8"));
      const db = drizzle(client, { schema });
      holder.db = db;
      const [owner] = await db.insert(schema.users).values({ name: "Owner" }).returning();
      const cloud = createInterfaceService(db);
      const project = await cloud.create(owner.id, manifest);
      const version = await cloud.publish(project.id, owner.id, "public");
      const fetcher = vi.fn(async () => Response.json({ output: [{ content: [{ type: "output_text", text: JSON.stringify(manifest) }] }] }));
      vi.stubGlobal("fetch", fetcher);
      process.env.AI_BUILDER_API_KEY = "PLATFORM_SECRET_ONLY_SERVER";
      process.env.AI_BUILDER_DAILY_LIMIT = "1";
      expect((await generate(request("/api/ai-builder/generate", { prompt: "Create an Interface about content" }))).status).toBe(401);
      expect(fetcher).not.toHaveBeenCalled();
      holder.viewer = owner.id;
      const response = await refine(request("/api/ai-builder/refine", { prompt: "Change the title scoring question", currentManifest: manifest }));
      expect(response.status).toBe(200);
      const responseText = await response.text();
      expect(responseText).not.toContain("PLATFORM_SECRET_ONLY_SERVER");
      expect(JSON.parse(responseText)).toMatchObject({ manifest: { schemaVersion: "1.0" } });
      expect((await generate(request("/api/ai-builder/generate", { prompt: "Create a different Interface" }))).status).toBe(429);
      expect(fetcher).toHaveBeenCalledTimes(1);
      const saved = await cloud.getVersion(project.id, version.id, owner.id);
      expect(saved.version.manifestJson).toMatchObject({ version: 1, metadata: manifest.metadata });
      const [usage] = await db.select().from(schema.aiBuilderUsage);
      expect(usage.requestCount).toBe(1);
    } finally { await client.close(); }
  });

  it("supports admin disable and rejects invalid prompts before quota", async () => {
    const client = new PGlite();
    try {
      await client.exec(readFileSync("src/db/migrations/0000_foundation.sql", "utf8"));
      await client.exec(readFileSync("src/db/migrations/0001_oauth_accounts.sql", "utf8"));
      await client.exec(readFileSync("src/db/migrations/0002_ai_builder.sql", "utf8"));
      const db = drizzle(client, { schema });
      holder.db = db;
      const [owner] = await db.insert(schema.users).values({ name: "Owner" }).returning();
      holder.viewer = owner.id;
      process.env.AI_BUILDER_API_KEY = "KEY";
      process.env.AI_BUILDER_ENABLED = "false";
      expect((await generate(request("/api/ai-builder/generate", { prompt: "Create an Interface about content" }))).status).toBe(503);
      expect((await generate(request("/api/ai-builder/generate", { prompt: "short" }))).status).toBe(400);
      expect(await db.select().from(schema.aiBuilderUsage)).toHaveLength(0);
    } finally { await client.close(); }
  });
});
