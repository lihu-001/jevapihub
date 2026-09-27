import type { JsonValue, TemplateValue } from "./types";

const OMIT = Symbol("omit optional input");

export function resolveState(template: TemplateValue, inputs: Record<string, JsonValue>): JsonValue {
  const state = resolve(template, inputs);
  if (state === OMIT || !(typeof state === "string" || Array.isArray(state) || (state !== null && typeof state === "object"))) {
    throw new Error("Resolved state must be a string, object, or array");
  }
  return state;
}

function resolve(value: TemplateValue, inputs: Record<string, JsonValue>): JsonValue | typeof OMIT {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      const result = resolve(item, inputs);
      return result === OMIT ? [] : [result];
    });
  }
  if (value && typeof value === "object") {
    if (Object.keys(value).length === 1 && "$input" in value) {
      return Object.hasOwn(inputs, value.$input as string) ? inputs[value.$input as string] : OMIT;
    }
    const object: Record<string, JsonValue> = Object.create(null);
    for (const [key, nested] of Object.entries(value)) {
      const result = resolve(nested, inputs);
      if (result !== OMIT) object[key] = result;
    }
    return object;
  }
  return value;
}
