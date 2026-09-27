import type { Manifest } from "./types";

export function createStarterManifest(): Manifest {
  return {
    schemaVersion: "1.0",
    metadata: {
      name: "新建 Interface", slug: "new-interface", description: "", category: "general", tags: [], language: "zh-CN",
    },
    runtime: { provider: "typesafe", model: "jev-latest", timeoutMs: 60_000, maxRetries: 2 },
    inputs: [{ id: "content", label: "待分析内容", component: "textarea", valueType: "string", required: true, constraints: { minLength: 1, maxLength: 50_000 } }],
    stateTemplate: { $input: "content" },
    questions: { assessment: { type: "noul", instructions: "内容是否满足你要判断的条件？" } },
    postprocess: { kind: "none" },
    resultView: { showRaw: true, showProbabilities: true, showConfidence: true, order: ["assessment"] },
    examples: [],
  };
}

export function createBuilderDefaultManifest(): Manifest {
  const starter = createStarterManifest();
  return {
    ...starter,
    inputs: [],
    stateTemplate: "您好，我尝试连接 Stripe 账户已经三天了，但集成一直失败，导致我流失了销售额。请尽快协助解决。",
    questions: {
      department: {
        type: "choice",
        instructions: "应由哪个团队处理此问题",
        criteria: {
          "支付": "支付或订阅相关问题",
          "技术": "程序错误（Bug）或集成问题",
          "销售": "定价或账户相关问题",
        },
      },
      frustration: {
        type: "score",
        instructions: "客户表现出的沮丧程度",
        criteria: ["情绪平静，仅陈述事实", "感到沮丧但态度客气", "非常愤怒，言辞激烈"],
      },
      is_urgent: {
        type: "noul",
        instructions: "该信息传达了紧迫性或时间敏感性",
      },
    },
    resultView: { ...starter.resultView, order: ["department", "frustration", "is_urgent"] },
  };
}
