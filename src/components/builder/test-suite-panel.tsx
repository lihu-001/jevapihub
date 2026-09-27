"use client";

import { useState } from "react";
import { evaluateExpectations } from "../../lib/eval/evaluate";
import type { Manifest } from "../../lib/manifest/types";
import { parseManifest } from "../../lib/manifest/validate";
import { readStateEditor } from "../../lib/manifest/state-editor";
import { parseTypeSafeResponse } from "../../lib/typesafe/response";

type TestCase = NonNullable<Manifest["examples"]>[number];
type Outcome = { name: string; passed: boolean; failures: string[] };

export function TestSuitePanel({ manifest, stateText, apiKey, onOpenKey, onChange, resetVersion }: {
  manifest: Manifest; stateText: string; apiKey: string; onOpenKey: () => void; onChange: (cases: TestCase[]) => void; resetVersion?: number;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [previousResetVersion, setPreviousResetVersion] = useState(resetVersion);
  if (previousResetVersion !== resetVersion) {
    setPreviousResetVersion(resetVersion);
    setError("");
    setOutcomes([]);
  }
  const cases = manifest.examples ?? [];

  function update(index: number, value: TestCase) {
    try {
      const next = cases.map((item, position) => position === index ? value : item);
      parseManifest({ ...manifest, stateTemplate: readStateEditor(stateText, manifest.stateTemplate), examples: next });
      onChange(next); setError(""); setOutcomes([]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "测试用例无效"); }
  }

  async function run() {
    const runnable = cases.filter((item) => item.expectations && Object.keys(item.expectations).length > 0);
    if (!runnable.length) { setError("请先为测试用例添加期望值"); return; }
    if (!apiKey) { onOpenKey(); setError("请先设置 TypeSafe API Key"); return; }
    setBusy(true); setError(""); setOutcomes([]);
    try {
      const validated = parseManifest({ ...manifest, stateTemplate: readStateEditor(stateText, manifest.stateTemplate) });
      const executionManifest = { ...validated, examples: [] };
      const results: Outcome[] = [];
      for (const item of runnable) {
        try {
          const response = await fetch("/api/runtime/playground", { method: "POST", cache: "no-store",
            headers: { "Content-Type": "application/json", "X-Typesafe-Api-Key": apiKey },
            body: JSON.stringify({ manifest: executionManifest, inputs: item.inputs }),
          });
          const data = await response.json() as { result?: unknown; error?: { message?: string } };
          if (!response.ok) throw new Error(data.error?.message ?? "运行失败");
          const answer = parseTypeSafeResponse(data.result, validated.questions);
          results.push({ name: item.name, ...evaluateExpectations(validated, answer, item.expectations!) });
        } catch (cause) { results.push({ name: item.name, passed: false, failures: [cause instanceof Error ? cause.message : "运行失败"] }); }
        setOutcomes([...results]);
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "测试集无效"); }
    finally { setBusy(false); }
  }

  return <section className="test-suite-panel" aria-labelledby="test-suite-title">
    <div className="section-head"><h2 id="test-suite-title">Test Cases</h2><button className="button button-small" type="button" disabled={cases.length >= 50} onClick={() => onChange([...cases, { name: `测试用例 ${cases.length + 1}`, inputs: {}, expectations: {} }])}>＋ 添加用例</button></div>
    <p className="field-hint">测试输入会随 Manifest 明确保存。测试运行结果只在当前页面显示，不会写入云端。</p>
    {cases.map((item, index) => <TestCaseEditor key={index} item={item} index={index} onSave={(next) => update(index, next)} onRemove={() => onChange(cases.filter((_, position) => position !== index))} />)}
    <button className="button button-primary" type="button" disabled={busy || cases.length === 0} aria-busy={busy} onClick={run}>{busy ? "测试中…" : "Run Test Suite"}</button>
    {error && <p className="error" role="alert">{error}</p>}
    {outcomes.length > 0 && <div role="status" aria-live="polite"><strong>Passed {outcomes.filter((item) => item.passed).length} / {outcomes.length}</strong>
      <ul>{outcomes.map((item, index) => <li key={index}>{item.passed ? "通过" : "失败"} · {item.name}{item.failures.length ? `：${item.failures.join("；")}` : ""}</li>)}</ul>
      <p className="field-hint">小测试集用于回归检查，不代表准确率证明。</p>
    </div>}
  </section>;
}

function TestCaseEditor({ item, index, onSave, onRemove }: { item: TestCase; index: number; onSave: (value: TestCase) => void; onRemove: () => void }) {
  const [name, setName] = useState(item.name);
  const [inputsText, setInputsText] = useState(JSON.stringify(item.inputs, null, 2));
  const [expectationsText, setExpectationsText] = useState(JSON.stringify(item.expectations ?? {}, null, 2));
  const [error, setError] = useState("");
  function save() {
    try {
      const inputs: unknown = JSON.parse(inputsText);
      const expectations: unknown = JSON.parse(expectationsText);
      if (!inputs || typeof inputs !== "object" || Array.isArray(inputs) || !expectations || typeof expectations !== "object" || Array.isArray(expectations)) throw new Error("输入与期望值都必须是 JSON 对象");
      onSave({ name, inputs: inputs as TestCase["inputs"], expectations: expectations as TestCase["expectations"] });
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "JSON 无效"); }
  }
  return <details className="editor-card"><summary>{item.name}</summary>
    <label className="field"><span>用例名称</span><input value={name} onChange={(event) => setName(event.target.value)} /></label>
    <label className="field"><span>Inputs JSON</span><textarea className="mono" rows={4} value={inputsText} onChange={(event) => setInputsText(event.target.value)} /></label>
    <label className="field"><span>期望值 JSON</span><textarea className="mono" rows={4} value={expectationsText} onChange={(event) => setExpectationsText(event.target.value)} placeholder={'{"quality.score":{"min":1.5}}'} /></label>
    <p className="field-hint">格式：questionId.choice 为允许选项数组；questionId.score / .noul 为 min、max 范围。</p>
    <div className="dialog-actions"><button className="button" type="button" onClick={onRemove}>删除用例 {index + 1}</button><button className="button button-primary" type="button" onClick={save}>保存用例</button></div>
    {error && <p className="error" role="alert">{error}</p>}
  </details>;
}
