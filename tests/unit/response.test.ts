import { describe, expect, it } from "vitest";
import { manifest, providerResponse } from "../fixture";
import { parseTypeSafeResponse } from "../../src/lib/typesafe/response";
import { applyWeightedScore } from "../../src/lib/postprocess/weighted-score";
import { redactSecrets } from "../../src/lib/typesafe/sanitize";

const copy = () => structuredClone(providerResponse);

describe("TypeSafe response and weighted score", () => {
  it("parses all three answer kinds and computes normalized score", () => {
    const response = parseTypeSafeResponse(copy(), manifest.questions);
    expect(applyWeightedScore(manifest, response)).toEqual([{ id: "overall", label: "Overall", value: 76.3, scale: 100 }]);
  });
  it("rejects missing, invalid and inconsistent answers", () => {
    const missing = copy();
    delete (missing.answers as Partial<typeof missing.answers>).truth;
    expect(() => parseTypeSafeResponse(missing, manifest.questions)).toThrow("UPSTREAM_INVALID_RESPONSE");
    const badNoul = copy();
    badNoul.answers.truth.noul = 2;
    expect(() => parseTypeSafeResponse(badNoul, manifest.questions)).toThrow();
    const badChoice = copy();
    badChoice.answers.tone.probabilities = { calm: 0.1, urgent: 0.2 };
    expect(() => parseTypeSafeResponse(badChoice, manifest.questions)).toThrow();
    const badScore = copy();
    badScore.answers.quality.score = 3;
    expect(() => parseTypeSafeResponse(badScore, manifest.questions)).toThrow();
  });
  it("redacts named secret fields and known secret values", () => {
    expect(redactSecrets({ Authorization: "Bearer xyz", nested: { message: "xyz", apiKey: "xyz" } }, ["xyz"]))
      .toEqual({ Authorization: "[REDACTED]", nested: { message: "[REDACTED]", apiKey: "[REDACTED]" } });
  });
});
