import { z } from "zod";
import { idSchema, json, jsonBody, service, viewerId, handleCloudError } from "../../../../../../../lib/interfaces/http";
import { runManifest } from "../../../../../../../lib/runtime/run";
import { RuntimeError } from "../../../../../../../lib/typesafe/errors";
import { getDatabase } from "../../../../../../../db/database";
import * as schema from "../../../../../../../db/schema";
import { enforceRuntimeRateLimit } from "../../../../../../../lib/runtime/rate-limit";

type Context = { params: Promise<{ interfaceId: string; versionId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const userId = await viewerId();
    enforceRuntimeRateLimit(request, userId);
    const apiKey = request.headers.get("x-typesafe-api-key") ?? "";
    if (!apiKey.trim()) throw new RuntimeError("MISSING_TYPESAFE_KEY", 400);
    const { interfaceId, versionId } = await context.params;
    const body = z.object({ inputs: z.record(z.string(), z.unknown()) }).strict().parse(await jsonBody(request));
    const saved = await service().getVersion(idSchema.parse(interfaceId), idSchema.parse(versionId), userId);
    const started = performance.now();
    try {
      const output = await runManifest(saved.version.manifestJson, body.inputs, apiKey);
      try {
        await getDatabase().insert(schema.runEvents).values({ interfaceId, interfaceVersionId: versionId, userId,
          success: true, providerModel: output.result.model, inputTokens: output.result.usage.input_tokens,
          outputTokens: output.result.usage.output_tokens, latencyMs: Math.max(0, Math.round(performance.now() - started)),
        });
      } catch { /* Metrics must not replace a successful provider response. */ }
      return json(output);
    } catch (error) {
      try {
        await getDatabase().insert(schema.runEvents).values({ interfaceId, interfaceVersionId: versionId, userId,
          success: false, providerModel: saved.version.manifestJson.runtime.model,
          latencyMs: Math.max(0, Math.round(performance.now() - started)),
        });
      } catch { /* Preserve the original runtime error. */ }
      throw error;
    }
  } catch (error) { return handleCloudError(error); }
}
