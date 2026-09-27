import { z } from "zod";
import { getDatabase } from "../../../../../db/database";
import { createHubService } from "../../../../../lib/hub/service";
import { handleCloudError, idSchema, json, jsonBody, ownerId } from "../../../../../lib/interfaces/http";

type Context = { params: Promise<{ id: string }> };
const bodySchema = z.object({ versionId: z.uuid().optional() }).strict();

export async function POST(request: Request, context: Context) {
  try {
    const userId = await ownerId();
    const id = idSchema.parse((await context.params).id);
    const { versionId } = bodySchema.parse(await jsonBody(request));
    const forked = await createHubService(getDatabase()).fork(id, versionId, userId);
    return json({ interface: forked }, 201);
  } catch (error) { return handleCloudError(error); }
}
