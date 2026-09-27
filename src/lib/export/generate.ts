import { resolveState } from "../manifest/resolve-state";
import type { JsonValue, Manifest } from "../manifest/types";
import { parseManifest } from "../manifest/validate";

export type ExportFormat = "manifest" | "python" | "typescript" | "curl";

function sampleInputs(manifest: Manifest): Record<string, JsonValue> {
  const supplied = manifest.examples?.[0]?.inputs ?? {};
  const values: Record<string, JsonValue> = {};
  for (const input of manifest.inputs) {
    if (Object.hasOwn(supplied, input.id)) values[input.id] = supplied[input.id];
    else if (input.defaultValue !== undefined) values[input.id] = input.defaultValue;
    else if (input.required) {
      values[input.id] = input.options?.[0]?.value ?? (input.valueType === "number" ? input.constraints?.minimum ?? 0
        : input.valueType === "boolean" ? false : input.valueType === "json" ? {} : "REPLACE_ME");
    }
  }
  return values;
}

function shellQuote(value: string) { return `'${value.replaceAll("'", "'\\''")}'`; }

export function generateExport(rawManifest: unknown, format: ExportFormat): { filename: string; contentType: string; content: string } {
  const manifest = parseManifest(rawManifest);
  const samples = sampleInputs(manifest);
  const base = `${manifest.metadata.slug}.jev-interface`;
  if (format === "manifest") return { filename: `${base}.json`, contentType: "application/json", content: `${JSON.stringify(manifest, null, 2)}\n` };
  if (format === "curl") {
    const body = { state: resolveState(manifest.stateTemplate, samples), model: manifest.runtime.model, questions: manifest.questions };
    return { filename: `${base}.sh`, contentType: "text/plain", content: `#!/usr/bin/env bash
# Review the example state before running. Set TYPESAFE_API_KEY in your shell.
curl --fail-with-body --request POST 'https://api.typesafe.ai/v1/systemone' \\
  --header "Authorization: Bearer $TYPESAFE_API_KEY" \\
  --header 'Content-Type: application/json' \\
  --data-raw ${shellQuote(JSON.stringify(body))}
` };
  }
  if (format === "python") return { filename: `${base}.py`, contentType: "text/x-python", content: `#!/usr/bin/env python3
"""Run this Interface with your own TypeSafe API key."""
import json
import os
import urllib.request

MANIFEST = json.loads(${JSON.stringify(JSON.stringify(manifest))})
SAMPLE_INPUTS = json.loads(${JSON.stringify(JSON.stringify(samples))})

def resolve(value, inputs):
    if isinstance(value, list):
        return [result for item in value if (result := resolve(item, inputs)) is not OMIT]
    if isinstance(value, dict):
        if set(value) == {"$input"}:
            return inputs.get(value["$input"], OMIT)
        return {key: result for key, item in value.items() if (result := resolve(item, inputs)) is not OMIT}
    return value

OMIT = object()

def main():
    api_key = os.environ["TYPESAFE_API_KEY"]
    state = resolve(MANIFEST["stateTemplate"], SAMPLE_INPUTS)
    body = {"state": state, "model": MANIFEST["runtime"]["model"], "questions": MANIFEST["questions"]}
    request = urllib.request.Request(
        "https://api.typesafe.ai/v1/systemone",
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers={"Authorization": "Bearer " + api_key, "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        print(response.read().decode("utf-8"))

if __name__ == "__main__":
    main()
` };
  return { filename: `${base}.ts`, contentType: "text/typescript", content: `// Run with a TypeScript runtime that provides fetch and process.
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
const manifest = ${JSON.stringify(manifest, null, 2)};
const sampleInputs: Record<string, JsonValue> = ${JSON.stringify(samples, null, 2)};
const OMIT = Symbol("omit");

function resolve(value: JsonValue, inputs: Record<string, JsonValue>): JsonValue | typeof OMIT {
  if (Array.isArray(value)) return value.flatMap((item) => {
    const result = resolve(item, inputs);
    return result === OMIT ? [] : [result];
  });
  if (value && typeof value === "object") {
    if (Object.keys(value).length === 1 && "$input" in value) return Object.hasOwn(inputs, value.$input as string) ? inputs[value.$input as string] : OMIT;
    const next: Record<string, JsonValue> = {};
    for (const [key, item] of Object.entries(value)) {
      const result = resolve(item, inputs);
      if (result !== OMIT) next[key] = result;
    }
    return next;
  }
  return value;
}

async function main() {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) throw new Error("Set TYPESAFE_API_KEY first");
  const state = resolve(manifest.stateTemplate, sampleInputs);
  if (state === OMIT) throw new Error("Invalid state template");
  const response = await fetch("https://api.typesafe.ai/v1/systemone", {
    method: "POST",
    headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ state, model: manifest.runtime.model, questions: manifest.questions }),
  });
  if (!response.ok) throw new Error("TypeSafe returned HTTP " + response.status);
  process.stdout.write(await response.text());
}
main().catch((error: unknown) => { process.stderr.write(String(error)); process.exitCode = 1; });
` };
}
