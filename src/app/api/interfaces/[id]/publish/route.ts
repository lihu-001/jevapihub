import { z } from "zod";
import { handleCloudError, idSchema, json, jsonBody, ownerId, service, visibilitySchema } from "../../../../../lib/interfaces/http";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const id = idSchema.parse((await context.params).id);
    const owner = await ownerId();
    const { visibility } = z.object({ visibility: visibilitySchema.optional() }).strict().parse(await jsonBody(request));
    const version = await service().publish(id, owner, visibility);
    return json({ version }, 201);
  } catch (error) { return handleCloudError(error); }
}
