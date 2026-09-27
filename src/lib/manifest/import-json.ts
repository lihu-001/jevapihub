import { createStarterManifest } from "./starter";
import { ManifestValidationError, parseManifest } from "./validate";
import type { Manifest } from "./types";

export function parseBuilderJson(value: unknown): { kind: "manifest" | "request"; manifest: Manifest } {
  if (value && typeof value === "object" && !Array.isArray(value) && Object.hasOwn(value, "schemaVersion")) {
    return { kind: "manifest", manifest: parseManifest(value) };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ManifestValidationError(["JSON 顶层必须是对象"]);
  }
  const request = value as Record<string, unknown>;
  if (!["state", "model", "questions"].every((key) => Object.hasOwn(request, key))) {
    throw new ManifestValidationError(["TypeSafe 请求需要 state、model 和 questions"]);
  }
  if (Object.keys(request).some((key) => !["state", "model", "questions"].includes(key))) {
    throw new ManifestValidationError(["TypeSafe 请求只支持 state、model 和 questions，不能包含额外字段"]);
  }
  if (!request.questions || typeof request.questions !== "object" || Array.isArray(request.questions)) {
    throw new ManifestValidationError(["questions 必须是对象"]);
  }
  const starter = createStarterManifest();
  const manifest = parseManifest({
    ...starter,
    inputs: [],
    stateTemplate: request.state,
    runtime: { ...starter.runtime, model: request.model },
    questions: request.questions,
    resultView: { ...starter.resultView, order: Object.keys(request.questions) },
  });
  return { kind: "request", manifest };
}
