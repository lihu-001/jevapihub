import type { InputDefinition, JsonValue, Manifest } from "./types";

export class InputValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super("Invalid Interface inputs");
  }
}

export function validateInputs(manifest: Manifest, raw: unknown): Record<string, JsonValue> {
  if (!raw || Array.isArray(raw) || typeof raw !== "object") {
    throw new InputValidationError(["Inputs must be a JSON object"]);
  }
  const source = raw as Record<string, unknown>;
  const values: Record<string, JsonValue> = Object.create(null);
  const issues: string[] = [];
  const known = new Set(manifest.inputs.map((input) => input.id));
  for (const key of Object.keys(source)) if (!known.has(key)) issues.push(`Unknown input: ${key}`);
  for (const input of manifest.inputs) {
    const value = source[input.id] === undefined ? input.defaultValue : source[input.id];
    if (value === undefined || value === null || value === "") {
      if (input.required) issues.push(`Required input missing: ${input.id}`);
      continue;
    }
    if (!matchesValueType(input.valueType, value)) {
      issues.push(`Input ${input.id} has incorrect value type`);
      continue;
    }
    if (input.component === "select" && !input.options?.some((option) => JSON.stringify(option.value) === JSON.stringify(value))) {
      issues.push(`Input ${input.id} is not a defined option`);
    }
    if (typeof value === "string") {
      const length = [...value].length;
      if (input.constraints?.minLength !== undefined && length < input.constraints.minLength) issues.push(`Input ${input.id} is too short`);
      if (input.constraints?.maxLength !== undefined && length > input.constraints.maxLength) issues.push(`Input ${input.id} is too long`);
    }
    if (typeof value === "number") {
      if (input.constraints?.minimum !== undefined && value < input.constraints.minimum) issues.push(`Input ${input.id} is too small`);
      if (input.constraints?.maximum !== undefined && value > input.constraints.maximum) issues.push(`Input ${input.id} is too large`);
    }
    values[input.id] = value as JsonValue;
  }
  if (issues.length) throw new InputValidationError(issues);
  return values;
}

function matchesValueType(type: InputDefinition["valueType"], value: unknown): boolean {
  if (type === "json") return isJsonValue(value);
  return typeof value === type && (type !== "number" || Number.isFinite(value));
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (typeof value === "object") return Object.values(value).every(isJsonValue);
  return false;
}
