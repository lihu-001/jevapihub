"use client";

import { useMemo, useState } from "react";
import type { InputDefinition, JsonValue, Manifest } from "../../lib/manifest/types";
import { ManifestValidationError, parseManifest } from "../../lib/manifest/validate";
import { InputValidationError, validateInputs } from "../../lib/manifest/validate-inputs";
import { resolveState } from "../../lib/manifest/resolve-state";
import { parseTypeSafeResponse, type TypeSafeResponse } from "../../lib/typesafe/response";
import type { WeightedResult } from "../../lib/postprocess/weighted-score";
import { ResultView } from "../results/result-view";

type Props = { manifest: Manifest; stateText: string; apiKey: string; onOpenKey: () => void };
type RunOutput = { manifest: Manifest; result: TypeSafeResponse; metrics: WeightedResult[] };

function decodeInput(input: InputDefinition, raw: string | boolean | undefined): JsonValue | undefined {
  if (input.component === "boolean") return raw === true;
  if (raw === undefined || raw === "") return undefined;
  if (typeof raw !== "string") return undefined;
  if (input.component === "select") return input.options?.[Number(raw)]?.value;
  if (input.valueType === "number") return Number(raw);
  if (input.valueType === "json") {
    try { return JSON.parse(raw) as JsonValue; }
    catch { throw new Error(`输入 ${input.label} 的 JSON 格式无效`); }
  }
  return raw;
}

export function RunPanel({ manifest, stateText, apiKey, onOpenKey }: Props) {
  const [draftValues, setDraftValues] = useState<Record<string, string | boolean>>({});
  const [output, setOutput] = useState<RunOutput | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const prepared = useMemo(() => {
    try {
      const parsed = parseManifest({ ...manifest, stateTemplate: JSON.parse(stateText) as unknown });
      const rawInputs = Object.fromEntries(parsed.inputs.map((input) => [input.id, decodeInput(input, draftValues[input.id])]));
      const inputs = validateInputs(parsed, rawInputs);
      return { manifest: parsed, inputs, state: resolveState(parsed.stateTemplate, inputs), issue: "" };
    } catch (caught) {
      const issue = caught instanceof ManifestValidationError || caught instanceof InputValidationError ? caught.issues.join("；")
        : caught instanceof SyntaxError ? "State Template JSON 格式无效"
          : caught instanceof Error ? caught.message : "输入无效";
      return { manifest: null, inputs: null, state: null, issue };
    }
  }, [manifest, stateText, draftValues]);

  async function run() {
    setError("");
    if (!prepared.manifest || !prepared.inputs) { setError(prepared.issue); return; }
    if (!apiKey) { onOpenKey(); setError("请先输入 TypeSafe API Key"); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/runtime/playground", {
        method: "POST", cache: "no-store",
        headers: { "Content-Type": "application/json", "X-Typesafe-Api-Key": apiKey },
        body: JSON.stringify({ manifest: prepared.manifest, inputs: prepared.inputs }),
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        const failure = body as { error?: { message?: string } };
        throw new Error(failure.error?.message ?? "运行失败");
      }
      const success = body as { result?: unknown; metrics?: unknown };
      const result = parseTypeSafeResponse(success.result, prepared.manifest.questions);
      const metrics = Array.isArray(success.metrics) ? success.metrics as WeightedResult[] : [];
      setOutput({ manifest: prepared.manifest, result, metrics });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "运行失败");
    } finally { setBusy(false); }
  }

  return <section aria-labelledby="run-title">
    <div className="panel-title"><h2 id="run-title">预览与运行</h2><span>Playground</span></div>
    <div className="notice">API Key 仅用于当前请求。运行的输入与原始答案默认不会保存到服务器。</div>
    <div className="divider" />
    <div className="section-head"><h3>测试输入</h3><button className="button button-small" type="button" onClick={onOpenKey}>{apiKey ? "更换 API Key" : "设置 API Key"}</button></div>
    <div className="stack">{manifest.inputs.map((input) => <InputControl key={input.id} input={input} value={draftValues[input.id]} onChange={(value) => setDraftValues((current) => ({ ...current, [input.id]: value }))} />)}</div>
    <div className="divider" />
    <div className="section-head"><h3>Resolved State Preview</h3></div>
    {prepared.issue ? <p className={prepared.issue.startsWith("Required input missing") ? "muted" : "error"} role="status">{prepared.issue.startsWith("Required input missing") ? "填写必填输入后显示解析后的 State。" : prepared.issue}</p> : <pre>{JSON.stringify(prepared.state, null, 2)}</pre>}
    <details><summary>Request Preview（不含 API Key）</summary><pre>{JSON.stringify({ state: prepared.state, model: manifest.runtime.model, questions: manifest.questions }, null, 2)}</pre></details>
    <div className="run-action"><button className="button button-primary" type="button" disabled={busy || !!prepared.issue} aria-busy={busy} onClick={run}>{busy ? "运行中…" : "运行 Interface"}</button></div>
    {error && <p role="alert" className="error">{error}</p>}
    {output && <><div className="divider" /><ResultView manifest={output.manifest} result={output.result} metrics={output.metrics} /></>}
  </section>;
}

function InputControl({ input, value, onChange }: { input: InputDefinition; value?: string | boolean; onChange: (value: string | boolean) => void }) {
  const id = `run-${input.id}`;
  const label = `${input.label}${input.required ? " *" : ""}`;
  if (input.component === "boolean") return <label className="checkline" htmlFor={id}><input id={id} type="checkbox" checked={value === true} onChange={(event) => onChange(event.target.checked)} />{label}</label>;
  if (input.component === "select") return <label className="field" htmlFor={id}><span>{label}</span><select id={id} value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)}>
    <option value="">请选择</option>{input.options?.map((option, index) => <option key={index} value={String(index)}>{option.label}</option>)}
  </select></label>;
  if (input.component === "textarea" || input.component === "json") return <label className="field" htmlFor={id}><span>{label}</span><textarea id={id} className={input.component === "json" ? "mono" : ""} value={typeof value === "string" ? value : ""} placeholder={input.placeholder} onChange={(event) => onChange(event.target.value)} /></label>;
  return <label className="field" htmlFor={id}><span>{label}</span><input id={id} type={input.component === "number" ? "number" : "text"} value={typeof value === "string" ? value : ""} placeholder={input.placeholder} onChange={(event) => onChange(event.target.value)} /></label>;
}
