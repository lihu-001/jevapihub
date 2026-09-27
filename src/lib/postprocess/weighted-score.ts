import type { Manifest, WeightedMetric } from "../manifest/types";
import type { TypeSafeResponse } from "../typesafe/response";

export type WeightedResult = { id: string; label: string; value: number; scale: number };

export function applyWeightedScore(manifest: Manifest, response: TypeSafeResponse): WeightedResult[] {
  if (manifest.postprocess?.kind !== "weighted_score") return [];
  return manifest.postprocess.metrics.map((metric) => calculateMetric(metric, manifest, response));
}

function calculateMetric(metric: WeightedMetric, manifest: Manifest, response: TypeSafeResponse): WeightedResult {
  let weightedSum = 0;
  let totalWeight = 0;
  for (const source of metric.sources) {
    const question = manifest.questions[source.questionId];
    const answer = response.answers[source.questionId];
    let percent: number;
    if (source.transform === "score_percent" && question.type === "score" && answer.type === "score") {
      percent = answer.score / (question.criteria.length - 1) * 100;
    } else if (source.transform === "noul_percent" && answer.type === "noul") {
      percent = answer.noul * 100;
    } else if (source.transform === "inverse_noul_percent" && answer.type === "noul") {
      percent = (1 - answer.noul) * 100;
    } else {
      throw new Error("Incompatible postprocess source");
    }
    weightedSum += percent * source.weight;
    totalWeight += source.weight;
  }
  if (!Number.isFinite(weightedSum) || !Number.isFinite(totalWeight) || totalWeight <= 0) {
    throw new Error("Invalid weighted score arithmetic");
  }
  const precision = metric.precision ?? 1;
  const value = Number(((weightedSum / totalWeight) * metric.scale / 100).toFixed(precision));
  if (!Number.isFinite(value)) throw new Error("Invalid weighted score result");
  return { id: metric.id, label: metric.label, value, scale: metric.scale };
}
