"use client";

import { useState } from "react";
import { prepareBuilderRequest, prepareEditedRequest } from "../../lib/manifest/builder-request";
import type { Manifest } from "../../lib/manifest/types";
import { ManifestValidationError } from "../../lib/manifest/validate";
import type { WeightedResult } from "../../lib/postprocess/weighted-score";
import type { TypeSafeRequest } from "../../lib/typesafe/client";
import { parseTypeSafeResponse, type TypeSafeResponse } from "../../lib/typesafe/response";
import { ResultView } from "../results/result-view";

type Props = { manifest: Manifest; stateText: string; questionError: string; apiKey: string; onOpenKey: () => void; onOpenJsonDebug?: () => void; professionalJson?: string };
type Output = { prepared: Manifest; result: TypeSafeResponse; metrics: WeightedResult[]; raw: unknown };

export function SimpleRunPanel({ manifest, stateText, questionError, apiKey, onOpenKey, onOpenJsonDebug, professionalJson }: Props) {
  const [output, setOutput] = useState<Output | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [requestDetailsOpen, setRequestDetailsOpen] = useState(false);
  const [requestDraft, setRequestDraft] = useState("");
  const [copyStatus, setCopyStatus] = useState("");

  async function copyRequest() {
    try {
      await navigator.clipboard.writeText(requestDraft);
      setCopyStatus("已复制");
    } catch {
      setCopyStatus("复制失败，请检查剪贴板权限");
    }
  }

  async function run() {
    setError("");
    setCopyStatus("");
    let prepared: Manifest;
    let request: TypeSafeRequest;
    try {
      if (professionalJson !== undefined) {
        ({ prepared, request } = prepareEditedRequest(professionalJson, manifest));
      } else {
        ({ prepared, request } = prepareBuilderRequest(manifest, stateText, questionError));
      }
      if (Object.values(prepared.questions).some((question) => typeof question.instructions === "string" && !question.instructions.trim())) {
        throw new Error("请填写每个 Question 的内容");
      }
    } catch (caught) {
      setError(caught instanceof ManifestValidationError ? caught.issues.join("；") : caught instanceof SyntaxError ? "State JSON 格式无效" : caught instanceof Error ? caught.message : "输入无效");
      return;
    }
    if (!apiKey) { setError("请先配置 API Key"); onOpenKey(); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/runtime/playground", {
        method: "POST", cache: "no-store",
        headers: { "Content-Type": "application/json", "X-Typesafe-Api-Key": apiKey },
        body: JSON.stringify({ manifest: prepared, inputs: { content: request.state } }),
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        const failure = body as { error?: { message?: string } };
        throw new Error(failure.error?.message ?? "运行失败");
      }
      const success = body as { result?: unknown; metrics?: unknown };
      const result = parseTypeSafeResponse(success.result, prepared.questions);
      const metrics = Array.isArray(success.metrics) ? success.metrics as WeightedResult[] : [];
      setOutput({ prepared, result, metrics, raw: body });
      if (professionalJson === undefined) setRequestDraft(JSON.stringify(request, null, 2));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "运行失败");
    } finally { setBusy(false); }
  }

  return <div>
    <div className="panel-title"><h2 id="run-title">预览与运行</h2><span>{professionalJson === undefined ? "03" : "02"}</span></div>
    <div className="run-access"><p>API Key 仅用于当前请求；运行不会单独保存输入或原始答案。</p></div>
    <button className="button button-primary run-button" type="button" disabled={busy} aria-busy={busy} onClick={run}>{busy ? "运行中…" : "运行"}</button>
    {error && <p className="error" role="alert">{error}</p>}
    {!output && !error && <p className="run-empty">点击运行后，在这里查看结果。</p>}
    {output && <div className="simple-results">
      <ResultView manifest={output.prepared} result={output.result} metrics={output.metrics} response={output.raw} />
      {professionalJson === undefined && <div className="result-detail-actions">
        <button className="button button-small" type="button" aria-expanded={requestDetailsOpen} aria-controls="request-json" onClick={() => setRequestDetailsOpen((value) => !value)}>{requestDetailsOpen ? "收起请求详情" : "请求详情"}</button>
      </div>}
      {professionalJson === undefined && requestDetailsOpen && <div className="json-detail">
        <div className="json-detail-header"><span>请求 JSON</span><div className="result-detail-actions"><button className="button button-small" type="button" onClick={copyRequest}>复制请求 JSON</button>{onOpenJsonDebug && <button className="button button-small" type="button" onClick={onOpenJsonDebug}>在 JSON 调试中编辑</button>}</div></div>
        {copyStatus && <p role="status">{copyStatus}</p>}
        <pre id="request-json" className="result-json">{requestDraft}</pre>
      </div>}
    </div>}
  </div>;
}
