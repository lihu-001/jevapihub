import { z } from "zod";
import { getDatabase } from "../../../../../../db/database";
import { createAdminService } from "../../../../../../lib/admin/service";
import { handleCloudError, idSchema, json, jsonBody, ownerId } from "../../../../../../lib/interfaces/http";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Context) {
  try {
    const userId = await ownerId();
    const id = idSchema.parse((await context.params).id);
    const { hidden } = z.object({ hidden: z.boolean() }).strict().parse(await jsonBody(request));
    await createAdminService(getDatabase()).setHidden(id, userId, hidden);
    return json({ hidden });
  } catch (error) { return handleCloudError(error); }
}
