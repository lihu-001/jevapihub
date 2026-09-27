import { z } from "zod";
import type { Question } from "../manifest/types";

const probability = z.number().finite().min(0).max(1);
const probabilityMap = z.record(z.string(), probability);
const noulAnswer = z.object({ type: z.literal("noul"), noul: probability });
const choiceAnswer = z.object({
  type: z.literal("choice"), choice: z.string(), probabilities: probabilityMap, confidence: probability,
});
const scoreAnswer = z.object({
  type: z.literal("score"), score: z.number().finite(), legend: z.record(z.string(), z.string()),
  probabilities: probabilityMap, confidence: probability,
});
const answer = z.discriminatedUnion("type", [noulAnswer, choiceAnswer, scoreAnswer]);
const responseSchema = z.object({
  model: z.string().min(1), answers: z.record(z.string(), answer),
  usage: z.object({ input_tokens: z.number().int().nonnegative(), output_tokens: z.number().int().nonnegative() }),
});

export type TypeSafeResponse = z.infer<typeof responseSchema>;

export class InvalidUpstreamResponseError extends Error {
  constructor() { super("UPSTREAM_INVALID_RESPONSE"); }
}

export function parseTypeSafeResponse(raw: unknown, questions: Record<string, Question>): TypeSafeResponse {
  const result = responseSchema.safeParse(raw);
  if (!result.success) throw new InvalidUpstreamResponseError();
  const { answers } = result.data;
  if (!sameKeys(answers, questions)) throw new InvalidUpstreamResponseError();
  for (const [id, question] of Object.entries(questions)) {
    const value = answers[id];
    if (value.type !== question.type) throw new InvalidUpstreamResponseError();
    if (value.type === "choice" && question.type === "choice") {
      if (!sameKeys(value.probabilities, question.criteria) || !Object.hasOwn(question.criteria, value.choice)) {
        throw new InvalidUpstreamResponseError();
      }
      if (!approximatelyOne(value.probabilities)) throw new InvalidUpstreamResponseError();
      const highest = Math.max(...Object.values(value.probabilities));
      if (value.probabilities[value.choice] < highest - 1e-6) throw new InvalidUpstreamResponseError();
    }
    if (value.type === "score" && question.type === "score") {
      const levels = Object.fromEntries(question.criteria.map((_, index) => [String(index), true]));
      if (!sameKeys(value.probabilities, levels) || !sameKeys(value.legend, levels)) throw new InvalidUpstreamResponseError();
      if (!approximatelyOne(value.probabilities) || value.score < 0 || value.score > question.criteria.length - 1) {
        throw new InvalidUpstreamResponseError();
      }
    }
  }
  return result.data;
}

function sameKeys(a: object, b: object): boolean {
  const aKeys = Object.keys(a);
  return aKeys.length === Object.keys(b).length && aKeys.every((key) => Object.hasOwn(b, key));
}

function approximatelyOne(values: Record<string, number>): boolean {
  return Math.abs(Object.values(values).reduce((sum, value) => sum + value, 0) - 1) <= 0.02;
}
