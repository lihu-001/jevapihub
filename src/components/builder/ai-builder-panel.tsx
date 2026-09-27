"use client";

import { useState } from "react";
import type { Manifest } from "../../lib/manifest/types";
import { parseManifest } from "../../lib/manifest/validate";

function changedParts(before: Manifest, after: Manifest): string[] {
  const parts: [string, unknown, unknown][] = [
    ["Metadata", before.metadata, after.metadata], ["Runtime", before.runtime, after.runtime],
    ["Inputs", before.inputs, after.inputs], ["State Template", before.stateTemplate, after.stateTemplate],
    ["Questions", before.questions, after.questions], ["Postprocess", before.postprocess, after.postprocess],
    ["Result View", before.resultView, after.resultView], ["Examples", before.examples, after.examples],
  ];
  return parts.filter(([, previous, next]) => JSON.stringify(previous) !== JSON.stringify(next)).map(([name]) => name);
}

export function AiBuilderPanel({ manifest, onApply, onClose }: { manifest: Manifest; onApply: (candidate: Manifest) => void; onClose: () => void }) {
  const [mode, setMode] = useState<"generate" | "refine">("refine");
  const [prompt, setPrompt] = useState("");
  const [candidate, setCandidate] = useState<Manifest | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true); setError(""); setCandidate(null);
    try {
      const response = await fetch(`/api/ai-builder/${mode}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
        body: JSON.stringify({ prompt, currentManifest: mode === "refine" ? manifest : null }),
      });
      const data = await response.json() as { manifest?: unknown; warnings?: string[]; error?: { message?: string } };
      if (!response.ok) throw new Error(data.error?.message ?? "AI Builder 暂不可用");
      setCandidate(parseManifest(data.manifest));
      setWarnings(Array.isArray(data.warnings) ? data.warnings : []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "AI Builder 暂不可用"); }
    finally { setLoading(false); }
  }

  const changes = candidate ? changedParts(manifest, candidate) : [];
  return <section className="ai-builder-panel" aria-labelledby="ai-builder-title">
    <div className="section-head"><h2 id="ai-builder-title">AI Builder</h2><button className="button button-small" type="button" onClick={onClose}>关闭</button></div>
    <div className="field-row"><label className="field"><span>操作</span><select value={mode} onChange={(event) => { setMode(event.target.value as typeof mode); setCandidate(null); }}>
      <option value="refine">修改当前 Manifest</option><option value="generate">按描述新建 Manifest</option>
    </select></label></div>
    <label className="field"><span>描述需求</span><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={4} minLength={10} maxLength={5000} placeholder="例如：加入标题清晰度评分，并保留现有输入和问题" /></label>
    <p className="field-hint">AI 结果先供预览；点击应用后才会进入当前 Draft。每次请求消耗一次每日配额。</p>
    <button className="button button-primary" type="button" onClick={submit} disabled={loading || prompt.trim().length < 10} aria-busy={loading}>{loading ? "生成中…" : "生成候选 Manifest"}</button>
    {error && <p className="notice" role="alert">{error}</p>}
    {candidate && <div className="ai-preview">
      <h3>变更预览</h3>
      <p>候选：{candidate.metadata.name} · {Object.keys(candidate.questions).length} 个 Questions · {candidate.inputs.length} 个 Inputs</p>
      <p>变更部分：{changes.length ? changes.join("、") : "无"}</p>
      {warnings.map((warning) => <p className="notice" key={warning}>{warning}</p>)}
      <details><summary>查看完整 JSON 对比</summary><div className="ai-json-compare"><div><h4>当前</h4><pre>{JSON.stringify(manifest, null, 2)}</pre></div><div><h4>候选</h4><pre>{JSON.stringify(candidate, null, 2)}</pre></div></div></details>
      <button className="button button-primary" type="button" onClick={() => { onApply(candidate); onClose(); }}>应用到 Draft</button>
    </div>}
  </section>;
}
