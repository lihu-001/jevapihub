import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../src/app/api/runtime/playground/route";
import { manifest, providerResponse } from "../fixture";

afterEach(() => vi.unstubAllGlobals());

function request(body: unknown, key = "TEST_SECRET_TYPESAFE_KEY_DO_NOT_STORE_123456") {
  return new Request("http://localhost/api/runtime/playground", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Typesafe-Api-Key": key },
    body: JSON.stringify(body),
  });
}

describe("POST /api/runtime/playground", () => {
  it("runs a guest Manifest and never echoes the key", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify(providerResponse)));
    vi.stubGlobal("fetch", fetcher);
    const result = await POST(request({ manifest, inputs: { text: "hello" } }));
    expect(result.status).toBe(200);
    expect(result.headers.get("Cache-Control")).toBe("no-store");
    expect((await result.text())).not.toContain("TEST_SECRET_TYPESAFE_KEY_DO_NOT_STORE_123456");
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("rejects missing key, malformed and oversized JSON without upstream traffic", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const missing = await POST(request({ manifest, inputs: { text: "hello" } }, ""));
    expect(missing.status).toBe(400);
    expect(await missing.json()).toMatchObject({ error: { code: "MISSING_TYPESAFE_KEY" } });
    const malformed = await POST(new Request("http://localhost/api/runtime/playground", {
      method: "POST", headers: { "Content-Type": "application/json", "X-Typesafe-Api-Key": "fake" }, body: "{",
    }));
    expect(malformed.status).toBe(400);
    const oversized = await POST(request({ manifest, inputs: { text: "a".repeat(1_100_000) } }));
    expect(oversized.status).toBe(413);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
