import type { InputDefinition, JsonValue, Manifest, TemplateValue } from "./types";
import { parseManifest } from "./validate";

export const BUILDER_INPUT_ID = "content";

function fillTemplate(value: TemplateValue, inputs: InputDefinition[]): JsonValue {
  if (Array.isArray(value)) return value.map((item) => fillTemplate(item, inputs));
  if (value && typeof value === "object") {
    if (Object.keys(value).length === 1 && "$input" in value) {
      return inputs.find((input) => input.id === value.$input)?.defaultValue ?? "";
    }
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, fillTemplate(item, inputs)]));
  }
  return value;
}

export function simplifyManifest(manifest: Manifest): Manifest {
  return {
    ...manifest,
    inputs: [],
    stateTemplate: fillTemplate(manifest.stateTemplate, manifest.inputs),
  };
}

export function formatSimpleState(value: TemplateValue): string {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

export function readSimpleState(text: string): string | JsonValue[] | Record<string, JsonValue> {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[") && !trimmed.startsWith('"')) return text;
  const value: unknown = JSON.parse(trimmed);
  if (typeof value !== "string" && (!value || typeof value !== "object")) {
    throw new Error("State 只能是字符串、JSON 对象或数组");
  }
  return value as string | JsonValue[] | Record<string, JsonValue>;
}

export function makeReusableManifest(manifest: Manifest): Manifest {
  const state = manifest.stateTemplate;
  const isText = typeof state === "string";
  return parseManifest({
    ...manifest,
    inputs: [{
      id: BUILDER_INPUT_ID,
      label: isText ? "待分析内容" : "输入 JSON",
      description: "运行时可以替换此示例内容",
      component: isText ? "textarea" : "json",
      valueType: isText ? "string" : "json",
      required: true,
      defaultValue: state,
    }],
    stateTemplate: { $input: BUILDER_INPUT_ID },
  });
}
