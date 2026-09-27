import type { Manifest } from "./types";

export function createStarterManifest(): Manifest {
  return {
    schemaVersion: "1.0",
    metadata: {
      name: "新建 Interface", slug: "new-interface", description: "", category: "general", tags: [], language: "zh-CN",
    },
    runtime: { provider: "typesafe", model: "jev-latest", timeoutMs: 60_000, maxRetries: 2 },
    inputs: [{ id: "content", label: "待分析内容", component: "textarea", valueType: "string", required: true, constraints: { minLength: 1, maxLength: 50_000 } }],
    stateTemplate: { content: { $input: "content" } },
    questions: { assessment: { type: "noul", instructions: "内容是否满足你要判断的条件？" } },
    postprocess: { kind: "none" },
    resultView: { showRaw: true, showProbabilities: true, showConfidence: true, order: ["assessment"] },
    examples: [],
  };
}
