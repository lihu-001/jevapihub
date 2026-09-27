import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as schema from "../../src/db/schema";
import { createInterfaceService } from "../../src/lib/interfaces/service";
import { manifest } from "../fixture";

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("../../src/db/database", () => ({ getDatabase: () => holder.db }));
vi.mock("../../src/lib/auth/current-user", () => ({ getCurrentUserId: async () => null }));

import { POST } from "../../src/app/api/runtime/interfaces/[interfaceId]/versions/[versionId]/route";

afterEach(() => { vi.unstubAllGlobals(); holder.db = null; });

describe("Saved Runtime route", () => {
  it("loads immutable questions from DB and rejects client question override", async () => {
    const client = new PGlite();
    try {
      await client.exec(readFileSync("src/db/migrations/0000_foundation.sql", "utf8"));
      await client.exec(readFileSync("src/db/migrations/0001_oauth_accounts.sql", "utf8"));
      const db = drizzle(client, { schema });
      holder.db = db;
      const [owner] = await db.insert(schema.users).values({ name: "Owner" }).returning();
      const service = createInterfaceService(db);
      const project = await service.create(owner.id, manifest);
      const version = await service.publish(project.id, owner.id, "public");
      const changed = structuredClone(manifest);
      changed.questions.truth.instructions = "New draft instruction";
      await service.saveDraft(project.id, owner.id, changed);
      const fetcher = vi.fn(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(init.body as string) as { questions: typeof manifest.questions };
        expect(body.questions.truth.instructions).toBe("Is it true?");
        return new Response(JSON.stringify({ model: "jev-1.13.0", answers: {
          truth: { type: "noul", noul: 0.2 },
          tone: { type: "choice", choice: "calm", probabilities: { calm: 0.8, urgent: 0.2 }, confidence: 0.8 },
          quality: { type: "score", score: 1.5, legend: { "0": "Bad", "1": "Okay", "2": "Good" }, probabilities: { "0": 0, "1": 0.5, "2": 0.5 }, confidence: 0.7 },
        }, usage: { input_tokens: 10, output_tokens: 2 } }));
      });
      vi.stubGlobal("fetch", fetcher);
      const context = { params: Promise.resolve({ interfaceId: project.id, versionId: version.id }) };
      const request = (body: unknown) => new Request("http://localhost/api/runtime/interfaces/x/versions/y", {
        method: "POST", headers: { "Content-Type": "application/json", "X-Typesafe-Api-Key": "TEST_SECRET_TYPESAFE_KEY_DO_NOT_STORE_123456" },
        body: JSON.stringify(body),
      });
      const denied = await POST(request({ inputs: { text: "hello" }, questions: { truth: { type: "noul", instructions: "override" } } }), context);
      expect(denied.status).toBe(400);
      expect(fetcher).not.toHaveBeenCalled();
      const result = await POST(request({ inputs: { text: "hello" } }), context);
      expect(result.status).toBe(200);
      expect(result.headers.get("Cache-Control")).toBe("no-store");
      expect((await result.text())).not.toContain("TEST_SECRET_TYPESAFE_KEY_DO_NOT_STORE_123456");
      expect(fetcher).toHaveBeenCalledOnce();
    } finally { await client.close(); }
  });
});
