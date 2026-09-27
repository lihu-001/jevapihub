import { validateManifestSchema } from "./schema";
import type { Manifest, TemplateValue } from "./types";

const MAX_MANIFEST_BYTES = 512 * 1024;
const forbiddenKey = /^(?:api[_-]?key|typesafe[_-]?api[_-]?key|authorization|script|function)$/i;

export class ManifestValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super("Invalid Interface Manifest");
  }
}

export function parseManifest(value: unknown): Manifest {
  if (!isJsonValue(value, new Set())) {
    throw new ManifestValidationError(["Manifest must contain only JSON values"]);
  }
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new ManifestValidationError(["Manifest must be JSON serializable"]);
  }
  if (!serialized || new TextEncoder().encode(serialized).length > MAX_MANIFEST_BYTES) {
    throw new ManifestValidationError(["Manifest exceeds 512 KB or is not JSON"]);
  }
  const json: unknown = JSON.parse(serialized);
  const issues: string[] = [];
  if (containsForbiddenKey(json)) issues.push("Manifest contains a forbidden credential or executable field");
  if (!validateManifestSchema(json)) {
    issues.push(...(validateManifestSchema.errors ?? []).map((error) => `${error.instancePath || "/"}: ${error.message}`));
  }
  if (issues.length) throw new ManifestValidationError(issues);
  const manifest = json as Manifest;
  const ids = new Set<string>();
  for (const input of manifest.inputs) {
    if (ids.has(input.id)) issues.push(`Duplicate input id: ${input.id}`);
    ids.add(input.id);
    const expected = { text: "string", textarea: "string", number: "number", boolean: "boolean", json: "json" } as const;
    if (input.component !== "select" && input.valueType !== expected[input.component]) {
      issues.push(`Input ${input.id} component and valueType disagree`);
    }
    if (input.component === "select" && (!input.options || input.options.length < 1)) {
      issues.push(`Select input ${input.id} requires options`);
    }
    if (input.defaultValue !== undefined && !matchesInputType(input.valueType, input.defaultValue)) {
      issues.push(`Input ${input.id} defaultValue has incorrect type`);
    }
    if (input.options?.some((option) => !matchesInputType(input.valueType, option.value))) {
      issues.push(`Input ${input.id} contains an option with incorrect type`);
    }
    if (input.constraints?.minLength !== undefined && input.constraints?.maxLength !== undefined && input.constraints.minLength > input.constraints.maxLength) {
      issues.push(`Input ${input.id} has inverted length limits`);
    }
    if (input.constraints?.minimum !== undefined && input.constraints?.maximum !== undefined && input.constraints.minimum > input.constraints.maximum) {
      issues.push(`Input ${input.id} has inverted number limits`);
    }
  }
  visitTemplate(manifest.stateTemplate, (id) => {
    if (!ids.has(id)) issues.push(`Unknown $input reference: ${id}`);
  });
  if (manifest.stateTemplate === null || typeof manifest.stateTemplate === "number" || typeof manifest.stateTemplate === "boolean") {
    issues.push("Root stateTemplate must resolve to a string, object, or array");
  }
  const questionIds = new Set(Object.keys(manifest.questions));
  for (const id of manifest.resultView.order) {
    if (!questionIds.has(id)) issues.push(`Unknown resultView question: ${id}`);
  }
  if (!manifest.runtime.model.trim()) issues.push("Model must not be blank");
  if (manifest.postprocess?.kind === "jsonlogic") issues.push("jsonlogic is not supported in Phase 0");
  if (manifest.postprocess?.kind === "weighted_score") {
    const metricIds = new Set<string>();
    for (const metric of manifest.postprocess.metrics) {
      if (metricIds.has(metric.id)) issues.push(`Duplicate metric id: ${metric.id}`);
      metricIds.add(metric.id);
      for (const source of metric.sources) {
        const question = manifest.questions[source.questionId];
        if (!question) issues.push(`Unknown postprocess question: ${source.questionId}`);
        else if (source.transform === "score_percent" ? question.type !== "score" : question.type !== "noul") {
          issues.push(`Transform ${source.transform} is incompatible with ${source.questionId}`);
        }
      }
    }
  }
  for (const example of manifest.examples ?? []) {
    for (const [key, expectation] of Object.entries(example.expectations ?? {})) {
      const separator = key.lastIndexOf(".");
      const questionId = key.slice(0, separator);
      const field = key.slice(separator + 1);
      const question = manifest.questions[questionId];
      if (!question || question.type !== field) { issues.push(`Invalid test expectation target: ${key}`); continue; }
      if (field === "choice" && question.type === "choice") {
        const options = Array.isArray(expectation) ? expectation : [expectation];
        if (options.some((option) => typeof option !== "string" || !Object.hasOwn(question.criteria, option))) {
          issues.push(`Invalid choice expectation: ${key}`);
        }
      } else {
        if (!expectation || typeof expectation !== "object" || Array.isArray(expectation)) {
          issues.push(`Numeric expectation requires min or max: ${key}`);
        } else if (expectation.min !== undefined && expectation.max !== undefined && expectation.min > expectation.max) {
          issues.push(`Inverted test expectation range: ${key}`);
        } else if (field === "noul" && ((expectation.min ?? 0) < 0 || (expectation.min ?? 0) > 1 || (expectation.max ?? 1) < 0 || (expectation.max ?? 1) > 1)) {
          issues.push(`Noul expectation must be between 0 and 1: ${key}`);
        } else if (question.type === "score" && ((expectation.min ?? 0) < 0 || (expectation.min ?? 0) > question.criteria.length - 1
          || (expectation.max ?? question.criteria.length - 1) < 0 || (expectation.max ?? question.criteria.length - 1) > question.criteria.length - 1)) {
          issues.push(`Score expectation is outside its levels: ${key}`);
        }
      }
    }
  }
  if (issues.length) throw new ManifestValidationError(issues);
  return manifest;
}

function matchesInputType(type: Manifest["inputs"][number]["valueType"], value: unknown): boolean {
  if (type === "json") return true;
  return typeof value === type;
}

function isJsonValue(value: unknown, seen: Set<object>): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object") return false;
  if (seen.has(value)) return false;
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null && !Array.isArray(value)) return false;
  seen.add(value);
  const valid = Object.values(value).every((nested) => isJsonValue(nested, seen));
  seen.delete(value);
  return valid;
}

function containsForbiddenKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsForbiddenKey);
  if (value && typeof value === "object") {
    return Object.entries(value).some(([key, nested]) => forbiddenKey.test(key) || containsForbiddenKey(nested));
  }
  return false;
}

function visitTemplate(value: TemplateValue, onInput: (id: string) => void): void {
  if (Array.isArray(value)) {
    for (const item of value) visitTemplate(item, onInput);
  } else if (value && typeof value === "object") {
    if (Object.keys(value).length === 1 && "$input" in value) onInput(value.$input as string);
    else for (const nested of Object.values(value)) visitTemplate(nested, onInput);
  }
}
