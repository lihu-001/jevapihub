import { runManifest } from "../../../../lib/runtime/run";
import { readRuntimeJson } from "../../../../lib/runtime/read-json";
import { RuntimeError } from "../../../../lib/typesafe/errors";
import { getCurrentUserId } from "../../../../lib/auth/current-user";
import { enforceRuntimeRateLimit } from "../../../../lib/runtime/rate-limit";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8" };

export async function POST(request: Request): Promise<Response> {
  try {
    enforceRuntimeRateLimit(request, await getCurrentUserId());
    const apiKey = request.headers.get("x-typesafe-api-key") ?? "";
    if (!apiKey.trim()) throw new RuntimeError("MISSING_TYPESAFE_KEY", 400);
    const body = await readRuntimeJson(request);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new RuntimeError("INVALID_INPUT", 400);
    const { manifest, inputs } = body as Record<string, unknown>;
    const output = await runManifest(manifest, inputs, apiKey);
    return new Response(JSON.stringify(output), { status: 200, headers });
  } catch (error) {
    const safe = error instanceof RuntimeError ? error : new RuntimeError("TYPESAFE_UNKNOWN_ERROR", 502);
    return new Response(JSON.stringify(safe.toJSON()), { status: safe.status, headers });
  }
}
