import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import ts from "typescript";
import { evaluateExpectations } from "../../src/lib/eval/evaluate";
import { generateExport } from "../../src/lib/export/generate";
import { parseManifest } from "../../src/lib/manifest/validate";
import { parseTypeSafeResponse } from "../../src/lib/typesafe/response";
import { manifest, providerResponse } from "../fixture";

describe("Test cases and code export", () => {
  it("validates expectation targets and ranges before a Manifest is saved", () => {
    const candidate = structuredClone(manifest);
    candidate.examples = [{ name: "A", inputs: { text: "hello" }, expectations: { "quality.score": { min: 1.5 }, "tone.choice": ["calm", "urgent"] } }];
    expect(parseManifest(candidate).examples).toHaveLength(1);
    candidate.examples[0].expectations = { "missing.score": { min: 1 } };
    expect(() => parseManifest(candidate)).toThrow();
    candidate.examples[0].expectations = { "truth.noul": { min: 2 } };
    expect(() => parseManifest(candidate)).toThrow();
    candidate.examples[0].expectations = { "tone.choice": ["not-an-option"] };
    expect(() => parseManifest(candidate)).toThrow();
  });

  it("compares choice, score, and noul answers without claiming accuracy", () => {
    const result = parseTypeSafeResponse(providerResponse, manifest.questions);
    expect(evaluateExpectations(manifest, result, { "tone.choice": ["calm"], "quality.score": { min: 1.5 }, "truth.noul": { max: 0.2 } }).passed).toBe(true);
    expect(evaluateExpectations(manifest, result, { "tone.choice": ["urgent"], "quality.score": { min: 1.6 } }).failures).toHaveLength(2);
  });

  it("generates all four formats from a validated Manifest without embedding credentials", () => {
    const candidate = structuredClone(manifest);
    candidate.examples = [{ name: "Sample", inputs: { text: "sample content" } }];
    for (const format of ["manifest", "python", "typescript", "curl"] as const) {
      const file = generateExport(candidate, format);
      expect(file.content).not.toContain("TEST_SECRET_TYPESAFE_KEY_DO_NOT_STORE_123456");
      expect(file.content).not.toContain("Bearer TEST_SECRET");
      expect(file.filename).toMatch(/^demo\.jev-interface\./);
      if (format !== "manifest") {
        expect(file.content).toContain("https://api.typesafe.ai/v1/systemone");
        expect(file.content).toContain("TYPESAFE_API_KEY");
        expect(file.content).toContain("sample content");
        expect(file.content).toContain("truth");
      }
    }
    expect(JSON.parse(generateExport(candidate, "manifest").content)).toEqual(candidate);
    const typescript = generateExport(candidate, "typescript").content;
    expect(ts.transpileModule(typescript, { compilerOptions: { target: ts.ScriptTarget.ES2022 }, reportDiagnostics: true }).diagnostics).toEqual([]);
    const python = spawnSync("python", ["-c", "import ast,sys; ast.parse(sys.stdin.read())"], { input: generateExport(candidate, "python").content, encoding: "utf8" });
    if (!python.error) expect(python.status).toBe(0);
  });
});
