import type { Manifest, TestExpectation } from "../manifest/types";
import type { TypeSafeResponse } from "../typesafe/response";

export function evaluateExpectations(manifest: Manifest, result: TypeSafeResponse, expectations: Record<string, TestExpectation>) {
  const failures: string[] = [];
  for (const [key, expectation] of Object.entries(expectations)) {
    const separator = key.lastIndexOf(".");
    const questionId = key.slice(0, separator);
    const field = key.slice(separator + 1);
    const answer = result.answers[questionId];
    if (!answer || answer.type !== manifest.questions[questionId]?.type || answer.type !== field) {
      failures.push(`${key}: missing or mismatched answer`); continue;
    }
    if (answer.type === "choice") {
      const allowed = Array.isArray(expectation) ? expectation : [expectation];
      if (!allowed.includes(answer.choice)) failures.push(`${key}: got ${answer.choice}`);
    } else if (answer.type === "score" || answer.type === "noul") {
      if (!expectation || typeof expectation !== "object" || Array.isArray(expectation)) {
        failures.push(`${key}: invalid expectation`); continue;
      }
      const actual = answer.type === "score" ? answer.score : answer.noul;
      if ((expectation.min !== undefined && actual < expectation.min) || (expectation.max !== undefined && actual > expectation.max)) {
        failures.push(`${key}: got ${actual}`);
      }
    }
  }
  return { passed: failures.length === 0, failures };
}
