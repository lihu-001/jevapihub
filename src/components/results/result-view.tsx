"use client";

import { useState } from "react";
import type { JsonValue, Manifest, Question } from "../../lib/manifest/types";
import type { WeightedResult } from "../../lib/postprocess/weighted-score";
import type { TypeSafeResponse } from "../../lib/typesafe/response";

type Props = { manifest: Manifest; result: TypeSafeResponse; metrics: WeightedResult[]; response?: unknown };

function describeValue(value: JsonValue): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function explainAnswer(question: Question, answer: TypeSafeResponse["answers"][string]): string {
  if (answer.type === "choice" && question.type === "choice") return `选项说明：${describeValue(question.criteria[answer.choice])}`;
  if (answer.type === "score" && question.type === "score") {
    const max = question.criteria.length - 1;
    return `加权得分，范围 0–${max}；从「${describeValue(question.criteria[0])}」到「${describeValue(question.criteria[max])}」。`;
  }
  if (answer.type === "noul") return "取值 0–1；越接近 1，越倾向符合这项判断。";
  return "";
}

export function ResultView({ manifest, result, metrics, response }: Props) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const responseJson = JSON.stringify(response ?? result, null, 2);

  async function copyResponse() {
    try { await navigator.clipboard.writeText(responseJson); setCopyStatus("已复制"); }
    catch { setCopyStatus("复制失败，请检查剪贴板权限"); }
  }

  return <section aria-labelledby="result-title">
    <div className="section-head"><h2 id="result-title">运行结果</h2><span className="muted mono">{result.model}</span></div>
    {metrics.length > 0 && <div className="result-metrics">{metrics.map((metric) => <div className="result-block" key={metric.id}>
      <h3>{metric.label}</h3><strong className="answer-value">{metric.value} / {metric.scale}</strong>
    </div>)}</div>}
    {manifest.resultView.order.map((id) => {
      const answer = result.answers[id];
      if (!answer) return null;
      return <div className="result-block" key={id}>
        <h3 className="mono">{id} <span className="muted">· {answer.type}</span></h3>
        <p className="result-question">{describeValue(manifest.questions[id].instructions)}</p>
        {answer.type === "noul" && <>
          <div className="answer-value">{answer.noul.toFixed(3)}</div>
          <progress className="meter" value={answer.noul} max={1} aria-label={`Noul 值 ${answer.noul.toFixed(3)}，范围 0 到 1`} />
          <small className="muted">0 — No tendency　·　1 — Yes tendency</small>
        </>}
        {answer.type === "choice" && <>
          <div className="answer-value">{answer.choice}</div>
          {manifest.resultView.showConfidence && <small className="muted">置信度 {answer.confidence.toFixed(3)}</small>}
          {manifest.resultView.showProbabilities && <Distribution probabilities={answer.probabilities} />}
        </>}
        {answer.type === "score" && <>
          <div className="answer-value">{answer.score.toFixed(3)} / {Object.keys(answer.legend).length - 1}</div>
          {manifest.resultView.showConfidence && <small className="muted">置信度 {answer.confidence.toFixed(3)}</small>}
          {manifest.resultView.showProbabilities && <Distribution probabilities={answer.probabilities} legend={answer.legend} />}
        </>}
        <p className="result-explanation">{explainAnswer(manifest.questions[id], answer)}</p>
      </div>;
    })}
    <p className="muted">Token 用量：输入 {result.usage.input_tokens}，输出 {result.usage.output_tokens}</p>
    <button className="button button-small" type="button" aria-expanded={detailsOpen} aria-controls="response-json" onClick={() => setDetailsOpen((value) => !value)}>{detailsOpen ? "收起响应详情" : "响应详情"}</button>
    {detailsOpen && <div className="json-detail">
      <div className="json-detail-header"><span>响应 JSON</span><button className="button button-small" type="button" onClick={copyResponse}>复制响应 JSON</button></div>
      {copyStatus && <p role="status">{copyStatus}</p>}
      <pre id="response-json" className="result-json">{responseJson}</pre>
    </div>}
  </section>;
}

function Distribution({ probabilities, legend }: { probabilities: Record<string, number>; legend?: Record<string, string> }) {
  return <div className="distribution">{Object.entries(probabilities).map(([key, value]) => <div className="distribution-row" key={key}>
    <span title={legend?.[key]}>{legend?.[key] ? `${key} · ${legend[key]}` : key}</span>
    <progress className="meter" value={value} max={1} aria-label={`${key} 概率 ${(value * 100).toFixed(1)}%`} />
    <span>{(value * 100).toFixed(1)}%</span>
  </div>)}</div>;
}
