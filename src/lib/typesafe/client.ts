import type { JsonValue, Question } from "../manifest/types";
import { RuntimeError, statusError } from "./errors";
import { InvalidUpstreamResponseError, parseTypeSafeResponse, type TypeSafeResponse } from "./response";

export const TYPESAFE_URL = "https://api.typesafe.ai/v1/systemone";

export type TypeSafeRequest = { state: JsonValue; model: string; questions: Record<string, Question> };
export type TypeSafeClientOptions = {
  fetcher?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
  maxRetries?: number;
};

export async function callTypeSafe(
  request: TypeSafeRequest, apiKey: string, options: TypeSafeClientOptions = {},
): Promise<TypeSafeResponse> {
  if (!apiKey.trim()) throw new RuntimeError("MISSING_TYPESAFE_KEY", 400);
  const fetcher = options.fetcher ?? fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const retries = options.maxRetries ?? 2;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetcher(TYPESAFE_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(request),
        cache: "no-store",
        signal: AbortSignal.timeout(options.timeoutMs ?? 60_000),
      });
      if (response.ok) {
        let raw: unknown;
        try { raw = await response.json(); }
        catch { throw new InvalidUpstreamResponseError(); }
        return parseTypeSafeResponse(raw, request.questions);
      }
      const error = statusError(response.status);
      if (error.retryable && attempt < retries) {
        await sleep(250 * 2 ** attempt);
        continue;
      }
      throw error;
    } catch (error) {
      if (error instanceof RuntimeError || error instanceof InvalidUpstreamResponseError) throw error;
      const timeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      if (attempt < retries) {
        await sleep(250 * 2 ** attempt);
        continue;
      }
      throw new RuntimeError(timeout ? "TYPESAFE_TIMEOUT" : "TYPESAFE_UNKNOWN_ERROR", 502, true);
    }
  }
  throw new RuntimeError("TYPESAFE_UNKNOWN_ERROR", 502, true);
}
