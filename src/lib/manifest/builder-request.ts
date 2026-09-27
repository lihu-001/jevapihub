import { resolveState } from "./resolve-state";
import { makeReusableManifest, readSimpleState } from "./simple-builder";
import type { Manifest } from "./types";
import { parseManifest } from "./validate";
import type { TypeSafeRequest } from "../typesafe/client";

export function prepareBuilderRequest(manifest: Manifest, stateText: string, questionError: string): { prepared: Manifest; request: TypeSafeRequest } {
  if (questionError) throw new Error(questionError);
  const draft = parseManifest({ ...manifest, stateTemplate: readSimpleState(stateText) });
  return { prepared: makeReusableManifest(draft), request: { state: resolveState(draft.stateTemplate, {}), model: draft.runtime.model, questions: draft.questions } };
}

export function prepareEditedRequest(text: string, manifest: Manifest): { prepared: Manifest; request: TypeSafeRequest } {
  let value: unknown;
  try { value = JSON.parse(text); }
  catch { throw new Error("请求 JSON 格式无效"); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("请求 JSON 必须是对象");
  const fields = value as Record<string, unknown>;
  if (Object.keys(fields).length !== 3 || !("state" in fields) || typeof fields.model !== "string"
    || !fields.questions || typeof fields.questions !== "object" || Array.isArray(fields.questions)) {
    throw new Error("请求 JSON 必须包含 state、model 和 questions，且不能有其他字段");
  }
  const draft = parseManifest({
    ...manifest,
    stateTemplate: fields.state,
    runtime: { ...manifest.runtime, model: fields.model },
    questions: fields.questions,
    resultView: { ...manifest.resultView, order: Object.keys(fields.questions) },
  });
  return { prepared: makeReusableManifest(draft), request: { state: resolveState(draft.stateTemplate, {}), model: draft.runtime.model, questions: draft.questions } };
}
