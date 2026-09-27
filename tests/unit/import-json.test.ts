import { describe, expect, it, vi } from "vitest";
import { parseBuilderJson } from "../../src/lib/manifest/import-json";
import { runManifest } from "../../src/lib/runtime/run";
import { manifest, providerResponse } from "../fixture";

const request = {
  state: "人类是猴子吗",
  model: "jev-latest",
  questions: { flag: { type: "noul", instructions: "人类是猴子吗" } },
};

describe("Builder JSON 导入", () => {
  it("将 TypeSafe 请求转换为无需填写输入的可运行 Manifest", () => {
    const imported = parseBuilderJson(request);
    expect(imported.kind).toBe("request");
    expect(imported.manifest.inputs).toEqual([]);
    expect(imported.manifest.stateTemplate).toBe(request.state);
    expect(imported.manifest.runtime.model).toBe(request.model);
    expect(imported.manifest.questions).toEqual(request.questions);
    expect(imported.manifest.resultView.order).toEqual(["flag"]);
  });

  it("保留原有完整 Manifest 导入", () => {
    expect(parseBuilderJson(manifest)).toEqual({ kind: "manifest", manifest });
  });

  it("运行时向 TypeSafe 发送与导入 JSON 相同的请求体", async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toEqual(request);
      return new Response(JSON.stringify({ ...providerResponse, answers: { flag: { type: "noul", noul: 0.83 } } }), { status: 200 });
    });
    const imported = parseBuilderJson(request);
    const output = await runManifest(imported.manifest, {}, "TEST_SECRET", { fetcher: fetcher as typeof fetch });
    expect(output.result.answers.flag).toMatchObject({ noul: 0.83 });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("拒绝缺失字段或额外字段，避免静默改变请求", () => {
    expect(() => parseBuilderJson({ state: request.state, model: request.model })).toThrow();
    expect(() => parseBuilderJson({ ...request, authorization: "secret" })).toThrow();
  });
});
