"use client";

import type { Manifest } from "../../lib/manifest/types";
import type { WeightedResult } from "../../lib/postprocess/weighted-score";
import type { TypeSafeResponse } from "../../lib/typesafe/response";

type Props = { manifest: Manifest; result: TypeSafeResponse; metrics: WeightedResult[] };

export function ResultView({ manifest, result, metrics }: Props) {
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
      </div>;
    })}
    <p className="muted">Token 用量：输入 {result.usage.input_tokens}，输出 {result.usage.output_tokens}</p>
    <details><summary>Raw JSON</summary><pre>{JSON.stringify(result, null, 2)}</pre></details>
  </section>;
}

function Distribution({ probabilities, legend }: { probabilities: Record<string, number>; legend?: Record<string, string> }) {
  return <div className="distribution">{Object.entries(probabilities).map(([key, value]) => <div className="distribution-row" key={key}>
    <span title={legend?.[key]}>{legend?.[key] ? `${key} · ${legend[key]}` : key}</span>
    <progress className="meter" value={value} max={1} aria-label={`${key} 概率 ${(value * 100).toFixed(1)}%`} />
    <span>{(value * 100).toFixed(1)}%</span>
  </div>)}</div>;
}
