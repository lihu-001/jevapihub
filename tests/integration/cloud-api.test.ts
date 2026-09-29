import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import * as schema from "../../src/db/schema";
import { manifest } from "../fixture";

const holder = vi.hoisted(() => ({ db: null as unknown, viewer: null as string | null }));
vi.mock("../../src/db/database", () => ({ getDatabase: () => holder.db }));
vi.mock("../../src/lib/auth/current-user", () => ({ getCurrentUserId: async () => holder.viewer }));

import { POST as create } from "../../src/app/api/interfaces/route";
import { PUT as save } from "../../src/app/api/interfaces/[id]/draft/route";
import { POST as publish } from "../../src/app/api/interfaces/[id]/publish/route";
import { GET as getVersion } from "../../src/app/api/interfaces/[id]/versions/[versionId]/route";
import { PATCH as patch, GET as getInterface } from "../../src/app/api/interfaces/[id]/route";

const request = (url: string, method: string, body: unknown) => new Request(`http://localhost${url}`, {
  method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});

describe("Cloud HTTP API", () => {
  it("enforces auth, saves Draft, publishes immutable versions, and hides private versions", async () => {
    const client = new PGlite();
    try {
      await client.exec(readFileSync("src/db/migrations/0000_foundation.sql", "utf8"));
      await client.exec(readFileSync("src/db/migrations/0001_oauth_accounts.sql", "utf8"));
      await client.exec(readFileSync("src/db/migrations/0002_ai_builder.sql", "utf8"));
      await client.exec(readFileSync("src/db/migrations/0003_interface_hub.sql", "utf8"));
      await client.exec(readFileSync("src/db/migrations/0004_admin_categories.sql", "utf8"));
      const db = drizzle(client, { schema });
      holder.db = db;
      const [owner] = await db.insert(schema.users).values({ name: "Owner" }).returning();
      const [other] = await db.insert(schema.users).values({ name: "Other" }).returning();
      holder.viewer = null;
      expect((await create(request("/api/interfaces", "POST", { manifest }))).status).toBe(401);
      holder.viewer = owner.id;
      const created = await create(request("/api/interfaces", "POST", { manifest }));
      expect(created.status).toBe(201);
      const project = (await created.json() as { interface: { id: string } }).interface;
      expect((await publish(request(`/api/interfaces/${project.id}/publish`, "POST", { visibility: "public" }), { params: Promise.resolve({ id: project.id }) })).status).toBe(403);
      expect((await patch(request(`/api/interfaces/${project.id}`, "PATCH", { visibility: "public" }), { params: Promise.resolve({ id: project.id }) })).status).toBe(403);
      await db.update(schema.users).set({ role: "admin" }).where(eq(schema.users.id, owner.id));
      const context = { params: Promise.resolve({ id: project.id }) };
      const first = await publish(request(`/api/interfaces/${project.id}/publish`, "POST", { visibility: "public" }), context);
      const v1 = (await first.json() as { version: { id: string; versionNumber: number } }).version;
      expect(v1.versionNumber).toBe(1);
      const changed = structuredClone(manifest);
      changed.questions.truth.instructions = "New draft";
      expect((await save(request(`/api/interfaces/${project.id}/draft`, "PUT", { manifest: changed }), context)).status).toBe(200);
      const second = await publish(request(`/api/interfaces/${project.id}/publish`, "POST", { visibility: "private" }), context);
      expect((await second.json() as { version: { versionNumber: number } }).version.versionNumber).toBe(2);
      const versionContext = { params: Promise.resolve({ id: project.id, versionId: v1.id }) };
      const ownerView = await getVersion(new Request("http://localhost/version"), versionContext);
      expect((await ownerView.json() as { version: { manifestJson: typeof manifest } }).version.manifestJson.questions.truth.instructions).toBe("Is it true?");
      holder.viewer = other.id;
      expect((await getVersion(new Request("http://localhost/version"), versionContext)).status).toBe(404);
      expect((await getInterface(new Request("http://localhost/interface"), context)).status).toBe(404);
      expect((await patch(request(`/api/interfaces/${project.id}`, "PATCH", { visibility: "public" }), context)).status).toBe(403);
    } finally { holder.viewer = null; holder.db = null; await client.close(); }
  });
});
