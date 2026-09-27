import { z } from "zod";
import { getDatabase } from "../../../../db/database";
import { runAiBuilder, AiBuilderError } from "../../../../lib/ai-builder/service";
import { handleCloudError, json, jsonBody, ownerId } from "../../../../lib/interfaces/http";

const bodySchema = z.object({ prompt: z.string().trim().min(10).max(5000), currentManifest: z.null().optional() }).strict();

export async function POST(request: Request) {
  try {
    const userId = await ownerId();
    const body = bodySchema.parse(await jsonBody(request));
    return json(await runAiBuilder(getDatabase(), userId, "generate", body.prompt, null));
  } catch (error) {
    if (error instanceof AiBuilderError) return json({ error: { code: error.code, message: error.code } }, error.status);
    return handleCloudError(error);
  }
}
