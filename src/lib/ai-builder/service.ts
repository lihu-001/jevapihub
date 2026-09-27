import { sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "../../db/schema";
import { parseManifest, ManifestValidationError } from "../manifest/validate";
import type { Manifest } from "../manifest/types";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const MAX_PROVIDER_BYTES = 1024 * 1024;

export class AiBuilderError extends Error {
  constructor(public readonly code: string, public readonly status: number) { super(code); }
}

type Db<T extends PgQueryResultHKT> = PgDatabase<T, typeof schema>;
type Mode = "generate" | "refine";

function config() {
  if (process.env.AI_BUILDER_ENABLED === "false") throw new AiBuilderError("AI_BUILDER_DISABLED", 503);
  const key = process.env.AI_BUILDER_API_KEY;
  if (!key) throw new AiBuilderError("AI_BUILDER_UNAVAILABLE", 503);
  const model = process.env.AI_BUILDER_MODEL || "gpt-4.1-mini";
  const rawLimit = Number(process.env.AI_BUILDER_DAILY_LIMIT || "10");
  const dailyLimit = Number.isInteger(rawLimit) && rawLimit > 0 && rawLimit <= 1000 ? rawLimit : 10;
  return { key, model, dailyLimit };
}

export async function claimAiBuilderQuota<T extends PgQueryResultHKT>(db: Db<T>, userId: string, dailyLimit: number) {
  const result: unknown = await db.execute(sql`
    INSERT INTO ai_builder_usage (user_id, usage_date, request_count)
    VALUES (${userId}::uuid, (now() AT TIME ZONE 'UTC')::date, 1)
    ON CONFLICT (user_id, usage_date)
    DO UPDATE SET request_count = ai_builder_usage.request_count + 1
    WHERE ai_builder_usage.request_count < ${dailyLimit}
    RETURNING request_count
  `);
  const rows = result && typeof result === "object" && "rows" in result ? result.rows : result;
  if (!Array.isArray(rows) || rows.length === 0) throw new AiBuilderError("AI_BUILDER_QUOTA_EXCEEDED", 429);
}

function extractOutput(body: unknown): string {
  if (!body || typeof body !== "object" || !("output" in body) || !Array.isArray(body.output)) {
    throw new AiBuilderError("AI_BUILDER_BAD_RESPONSE", 502);
  }
  const fragments: string[] = [];
  for (const item of body.output) {
    if (!item || typeof item !== "object" || !("content" in item) || !Array.isArray(item.content)) continue;
    for (const part of item.content) {
      if (part && typeof part === "object" && "type" in part && part.type === "output_text" && "text" in part && typeof part.text === "string") {
        fragments.push(part.text);
      }
    }
  }
  if (fragments.length === 0) throw new AiBuilderError("AI_BUILDER_BAD_RESPONSE", 502);
  return fragments.join("");
}

export async function requestManifestJson(messages: { role: "system" | "user"; content: string }[], fetcher: typeof fetch = fetch): Promise<string> {
  const { key, model } = config();
  let response: Response;
  try {
    response = await fetcher(OPENAI_RESPONSES_URL, {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, input: messages, text: { format: { type: "json_object" } }, max_output_tokens: 8000 }),
      cache: "no-store", signal: AbortSignal.timeout(60_000),
    });
  } catch { throw new AiBuilderError("AI_BUILDER_UPSTREAM_UNAVAILABLE", 502); }
  if (!response.ok) throw new AiBuilderError("AI_BUILDER_UPSTREAM_UNAVAILABLE", 502);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > MAX_PROVIDER_BYTES) throw new AiBuilderError("AI_BUILDER_BAD_RESPONSE", 502);
  let body: unknown;
  try { body = JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new AiBuilderError("AI_BUILDER_BAD_RESPONSE", 502); }
  return extractOutput(body);
}

const SYSTEM = `You create Jev Interface Manifest JSON. Return one JSON object only. Do not include markdown, code, credentials, scripts, or prose. The output must follow this shape: {"schemaVersion":"1.0","metadata":{"name":"...","slug":"lowercase-hyphen","description":"...","category":"general","tags":[],"language":"zh-CN"},"runtime":{"provider":"typesafe","model":"jev-latest","timeoutMs":60000,"maxRetries":2},"inputs":[{"id":"content","label":"...","component":"textarea","valueType":"string","required":true}],"stateTemplate":{"content":{"$input":"content"}},"questions":{"assessment":{"type":"noul","instructions":"..."}},"postprocess":{"kind":"none"},"resultView":{"showRaw":true,"showProbabilities":true,"showConfidence":true,"order":["assessment"]},"examples":[]}. Question types are noul, choice, score. Score criteria has 2 to 10 levels; choice criteria has up to 255 options. Every $input must match an input id. Every resultView.order id must exist in questions. Use only declarative postprocess. Never include an API key. Preserve existing runtime.model during refinement unless the user explicitly asks to change it.`;

function parseCandidate(text: string): Manifest {
  try { return parseManifest(JSON.parse(text) as unknown); }
  catch (error) {
    if (error instanceof ManifestValidationError) throw error;
    throw new ManifestValidationError(["AI output is not valid JSON"]);
  }
}

export async function buildManifest(mode: Mode, prompt: string, currentManifest: unknown, requester: typeof requestManifestJson = requestManifestJson) {
  const current = mode === "refine" ? parseManifest(currentManifest) : null;
  const userContent = mode === "generate"
    ? `Create a new Manifest for this request:\n${prompt}`
    : `Refine this existing Manifest according to the request. Preserve unrelated fields and do not modify a published version:\n${JSON.stringify(current)}\nRequest:\n${prompt}`;
  const messages = [{ role: "system" as const, content: SYSTEM }, { role: "user" as const, content: userContent }];
  const first = await requester(messages);
  try { return { manifest: parseCandidate(first), warnings: [] as string[] }; }
  catch (error) {
    if (!(error instanceof ManifestValidationError)) throw error;
    const repaired = await requester([...messages, { role: "user", content: `Your prior JSON was invalid. Fix it and return a complete valid Manifest JSON only. Validation errors: ${error.issues.slice(0, 15).join("; ")}. Prior output: ${first.slice(0, MAX_PROVIDER_BYTES)}` }]);
    try { return { manifest: parseCandidate(repaired), warnings: ["AI 首次输出无效，已自动修复一次；请测试后发布。"] }; }
    catch { throw new AiBuilderError("AI_BUILDER_INVALID_MANIFEST", 502); }
  }
}

export async function runAiBuilder<T extends PgQueryResultHKT>(db: Db<T>, userId: string, mode: Mode, prompt: string, currentManifest: unknown) {
  const { dailyLimit } = config();
  if (mode === "refine") parseManifest(currentManifest);
  await claimAiBuilderQuota(db, userId, dailyLimit);
  return buildManifest(mode, prompt, currentManifest);
}
