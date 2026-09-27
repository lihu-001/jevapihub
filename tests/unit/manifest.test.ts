import { describe, expect, it } from "vitest";
import { manifest } from "../fixture";
import { parseManifest } from "../../src/lib/manifest/validate";
import { validateInputs } from "../../src/lib/manifest/validate-inputs";
import { resolveState } from "../../src/lib/manifest/resolve-state";

const copy = () => structuredClone(manifest);

describe("Manifest validation and state", () => {
  it("accepts a valid Manifest and omits optional object/array inputs", () => {
    const value = parseManifest(copy());
    const inputs = validateInputs(value, { text: "hello" });
    expect(resolveState(value.stateTemplate, inputs)).toEqual({ text: "hello" });
    expect(resolveState([{ $input: "note" }, { $input: "text" }], inputs)).toEqual(["hello"]);
  });

  it("rejects unknown references and duplicate input ids", () => {
    const unknown = copy();
    unknown.stateTemplate = { $input: "missing" };
    expect(() => parseManifest(unknown)).toThrow(/Invalid Interface Manifest/);
    const duplicate = copy();
    duplicate.inputs.push(structuredClone(duplicate.inputs[0]));
    expect(() => parseManifest(duplicate)).toThrow();
  });

  it("enforces provider option limits and postprocess references", () => {
    const score = copy();
    score.questions.quality = { type: "score", instructions: "rate", criteria: Array(11).fill("level") };
    expect(() => parseManifest(score)).toThrow();
    const choice = copy();
    choice.questions.tone = { type: "choice", instructions: "pick", criteria: Object.fromEntries(Array.from({ length: 256 }, (_, i) => [String(i), null])) };
    expect(() => parseManifest(choice)).toThrow();
    const source = copy();
    if (source.postprocess?.kind === "weighted_score") source.postprocess.metrics[0].sources[0].questionId = "unknown";
    expect(() => parseManifest(source)).toThrow();
  });

  it("rejects credential fields, wrong input types, unknown inputs and overlong text", () => {
    expect(() => parseManifest({ ...copy(), apiKey: "secret" })).toThrow();
    expect(() => parseManifest({ ...copy(), hidden: () => "surprise" })).toThrow();
    expect(() => parseManifest({ ...copy(), hidden: Infinity })).toThrow();
    expect(() => validateInputs(manifest, { text: 123 })).toThrow();
    expect(() => validateInputs(manifest, { text: "hi", extra: true })).toThrow();
    expect(() => validateInputs(manifest, { text: "a".repeat(101) })).toThrow();
    expect(() => validateInputs(manifest, {})).toThrow();
    const badDefault = copy();
    badDefault.inputs[0].defaultValue = 42;
    expect(() => parseManifest(badDefault)).toThrow();
  });
});
