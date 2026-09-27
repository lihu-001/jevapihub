import { z } from "zod";
import { idSchema, json, jsonBody, service, viewerId, handleCloudError } from "../../../../../../../lib/interfaces/http";
import { runManifest } from "../../../../../../../lib/runtime/run";
import { RuntimeError } from "../../../../../../../lib/typesafe/errors";

type Context = { params: Promise<{ interfaceId: string; versionId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const apiKey = request.headers.get("x-typesafe-api-key") ?? "";
    if (!apiKey.trim()) throw new RuntimeError("MISSING_TYPESAFE_KEY", 400);
    const { interfaceId, versionId } = await context.params;
    const body = z.object({ inputs: z.record(z.string(), z.unknown()) }).strict().parse(await jsonBody(request));
    const saved = await service().getVersion(idSchema.parse(interfaceId), idSchema.parse(versionId), await viewerId());
    return json(await runManifest(saved.version.manifestJson, body.inputs, apiKey));
  } catch (error) { return handleCloudError(error); }
}
