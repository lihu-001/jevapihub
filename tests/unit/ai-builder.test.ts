import { afterEach, describe, expect, it, vi } from "vitest";
import { buildManifest, requestManifestJson } from "../../src/lib/ai-builder/service";
import { manifest } from "../fixture";

const previousKey = process.env.AI_BUILDER_API_KEY;
afterEach(() => { process.env.AI_BUILDER_API_KEY = previousKey; });

describe("AI Builder validation", () => {
  it("accepts a valid complete Manifest", async () => {
    const requester = vi.fn(async () => JSON.stringify(manifest));
    const result = await buildManifest("generate", "Create a content scoring Interface", null, requester);
    expect(result.manifest).toEqual(manifest);
    expect(result.warnings).toEqual([]);
    expect(requester).toHaveBeenCalledTimes(1);
  });

  it("repairs invalid output once, then reports a warning", async () => {
    const requester = vi.fn().mockResolvedValueOnce('{"invalid":true}').mockResolvedValueOnce(JSON.stringify(manifest));
    const result = await buildManifest("refine", "Change the question language", manifest, requester);
    expect(result.manifest).toEqual(manifest);
    expect(result.warnings).toHaveLength(1);
    expect(requester).toHaveBeenCalledTimes(2);
  });

  it("rejects a second invalid result without returning the raw output", async () => {
    const requester = vi.fn(async () => "not json TEST_SECRET_TYPESAFE_KEY_DO_NOT_STORE_123456");
    await expect(buildManifest("generate", "Create a scoring Interface", null, requester)).rejects.toMatchObject({ code: "AI_BUILDER_INVALID_MANIFEST" });
    expect(requester).toHaveBeenCalledTimes(2);
  });

  it("uses a fixed endpoint, extracts output_text across content, and does not expose the platform key", async () => {
    process.env.AI_BUILDER_API_KEY = "PLATFORM_TEST_SECRET";
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({ Authorization: "Bearer PLATFORM_TEST_SECRET" });
      expect(JSON.stringify(init?.body)).not.toContain("PLATFORM_TEST_SECRET");
      return Response.json({ output: [{ content: [{ type: "output_text", text: "{\"a\":" }, { type: "output_text", text: "1}" }] }] });
    });
    expect(await requestManifestJson([{ role: "user", content: "Return JSON" }], fetchMock as typeof fetch)).toBe('{"a":1}');
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.openai.com/v1/responses");
  });
});
