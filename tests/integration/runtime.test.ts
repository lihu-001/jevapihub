import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it, vi } from "vitest";
import { manifest, providerResponse } from "../fixture";
import { runManifest } from "../../src/lib/runtime/run";
import { callTypeSafe, TYPESAFE_URL } from "../../src/lib/typesafe/client";
import { redactSecrets } from "../../src/lib/typesafe/sanitize";

const SECRET = "TEST_SECRET_TYPESAFE_KEY_DO_NOT_STORE_123456";
const response = (status = 200) => new Response(JSON.stringify(providerResponse), { status });

describe("Runtime integration", () => {
  it("sends the fixed TypeSafe HTTP contract and runs declarative postprocess", async () => {
    const fetcher = vi.fn(async () => response()) as unknown as typeof fetch;
    const output = await runManifest(manifest, { text: "hello" }, SECRET, { fetcher });
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = (fetcher as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(TYPESAFE_URL);
    expect(init.method).toBe("POST");
    expect(init.cache).toBe("no-store");
    expect(init.headers).toEqual({ Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json" });
    expect(JSON.parse(init.body as string)).toEqual({
      state: { text: "hello" }, model: "jev-latest", questions: manifest.questions,
    });
    expect(output.metrics[0].value).toBe(76.3);
    expect(JSON.stringify(output)).not.toContain(SECRET);
  });

  it("maps 401/422, retries 429/529, and hides upstream content", async () => {
    const request = { state: "hello", model: "jev-latest", questions: manifest.questions };
    for (const [status, code] of [[401, "TYPESAFE_UNAUTHORIZED"], [422, "TYPESAFE_VALIDATION_ERROR"]] as const) {
      const fetcher = vi.fn(async () => new Response(SECRET, { status })) as unknown as typeof fetch;
      await expect(callTypeSafe(request, SECRET, { fetcher })).rejects.toMatchObject({ code });
      expect(fetcher).toHaveBeenCalledOnce();
    }
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response(429)).mockResolvedValueOnce(response(529)).mockResolvedValue(response()) as typeof fetch;
    const sleep = vi.fn(async () => undefined);
    await expect(callTypeSafe(request, SECRET, { fetcher, sleep })).resolves.toMatchObject({ model: "jev-1.13.0" });
    expect(sleep.mock.calls).toEqual([[250], [500]]);
  });

  it("rejects malformed provider JSON and a provider echo of the secret", async () => {
    const invalid = vi.fn(async () => new Response("not json")) as unknown as typeof fetch;
    await expect(runManifest(manifest, { text: "hello" }, SECRET, { fetcher: invalid }))
      .rejects.toMatchObject({ code: "UPSTREAM_INVALID_RESPONSE" });
    const echoed = structuredClone(providerResponse);
    echoed.model = SECRET;
    const fetcher = vi.fn(async () => new Response(JSON.stringify(echoed))) as unknown as typeof fetch;
    await expect(runManifest(manifest, { text: "hello" }, SECRET, { fetcher }))
      .rejects.toMatchObject({ code: "UPSTREAM_INVALID_RESPONSE" });
  });

  it("keeps the test Key out of DB, logs, response snapshots and exports", async () => {
    const db = new PGlite();
    try {
      await db.exec(readFileSync("src/db/migrations/0000_foundation.sql", "utf8"));
      const fetcher = vi.fn(async () => response()) as unknown as typeof fetch;
      const output = await runManifest(manifest, { text: "hello" }, SECRET, { fetcher });
      await db.query("INSERT INTO run_events(success, provider_model, input_tokens, output_tokens, latency_ms, provider_status) VALUES ($1, $2, $3, $4, $5, $6)",
        [true, output.result.model, output.result.usage.input_tokens, output.result.usage.output_tokens, 10, 200]);
      const loggerCapture = JSON.stringify(redactSecrets({ Authorization: `Bearer ${SECRET}`, status: 200 }, [SECRET]));
      const responseSnapshot = JSON.stringify(output);
      const exportFile = JSON.stringify(manifest);
      const tables = ["users", "interfaces", "interface_drafts", "interface_versions", "stars", "run_events"];
      const rows = await Promise.all(tables.map((table) => db.query(`SELECT row_to_json(t)::text AS data FROM ${table} t`)));
      const dbSnapshot = JSON.stringify(rows.map((result) => result.rows));
      const columns = await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public'");
      expect(JSON.stringify(columns.rows)).not.toMatch(/typesafe_api_key|api_key/i);
      for (const snapshot of [dbSnapshot, loggerCapture, responseSnapshot, exportFile]) {
        expect(snapshot).not.toContain(SECRET);
      }
    } finally {
      await db.close();
    }
  });

  it("prevents mutation of a published version at the database layer", async () => {
    const db = new PGlite();
    try {
      await db.exec(readFileSync("src/db/migrations/0000_foundation.sql", "utf8"));
      const user = await db.query<{ id: string }>("INSERT INTO users(name) VALUES ('Author') RETURNING id");
      const ownerId = user.rows[0].id;
      const iface = await db.query<{ id: string }>(
        "INSERT INTO interfaces(owner_id, name, slug, category, language) VALUES ($1, 'Demo', 'demo', 'test', 'zh-CN') RETURNING id", [ownerId]);
      const version = await db.query<{ id: string }>(
        "INSERT INTO interface_versions(interface_id, version_number, manifest_json, created_by) VALUES ($1, 1, $2, $3) RETURNING id",
        [iface.rows[0].id, JSON.stringify(manifest), ownerId]);
      await expect(db.query("UPDATE interface_versions SET changelog = 'changed' WHERE id = $1", [version.rows[0].id]))
        .rejects.toThrow(/immutable/);
    } finally {
      await db.close();
    }
  });
});
