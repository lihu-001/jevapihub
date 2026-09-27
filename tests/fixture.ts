import type { Manifest } from "../src/lib/manifest/types";

export const manifest: Manifest = {
  schemaVersion: "1.0",
  metadata: { name: "Demo", slug: "demo", description: "", category: "test", tags: [], language: "zh-CN" },
  runtime: { provider: "typesafe", model: "jev-latest", timeoutMs: 1000, maxRetries: 2 },
  inputs: [
    { id: "text", label: "Text", component: "textarea", valueType: "string", required: true, constraints: { maxLength: 100 } },
    { id: "note", label: "Note", component: "text", valueType: "string", required: false },
  ],
  stateTemplate: { text: { $input: "text" }, note: { $input: "note" } },
  questions: {
    truth: { type: "noul", instructions: "Is it true?" },
    tone: { type: "choice", instructions: "Tone?", criteria: { calm: "Calm", urgent: "Urgent" } },
    quality: { type: "score", instructions: "Quality?", criteria: ["Bad", "Okay", "Good"] },
  },
  postprocess: {
    kind: "weighted_score",
    metrics: [{ id: "overall", label: "Overall", scale: 100, precision: 1, sources: [
      { questionId: "quality", weight: 3, transform: "score_percent" },
      { questionId: "truth", weight: 1, transform: "inverse_noul_percent" },
    ] }],
  },
  resultView: { showRaw: true, showProbabilities: true, showConfidence: true, order: ["truth", "tone", "quality"] },
};

export const providerResponse = {
  model: "jev-1.13.0",
  answers: {
    truth: { type: "noul", noul: 0.2 },
    tone: { type: "choice", choice: "calm", probabilities: { calm: 0.8, urgent: 0.2 }, confidence: 0.8 },
    quality: { type: "score", score: 1.5, legend: { "0": "Bad", "1": "Okay", "2": "Good" }, probabilities: { "0": 0, "1": 0.5, "2": 0.5 }, confidence: 0.7 },
  },
  usage: { input_tokens: 100, output_tokens: 20 },
};
