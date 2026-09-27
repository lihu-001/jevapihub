import { z } from "zod";
import { getDatabase } from "../../../../../../db/database";
import { createHubService } from "../../../../../../lib/hub/service";
import { handleCloudError, idSchema, json, jsonBody, ownerId } from "../../../../../../lib/interfaces/http";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Context) {
  try {
    const userId = await ownerId();
    const id = idSchema.parse((await context.params).id);
    const { featured } = z.object({ featured: z.boolean() }).strict().parse(await jsonBody(request));
    await createHubService(getDatabase()).setFeatured(id, userId, featured);
    return json({ featured });
  } catch (error) { return handleCloudError(error); }
}
