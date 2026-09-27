import { z } from "zod";
import { handleCloudError, idSchema, json, jsonBody, ownerId, service, viewerId, visibilitySchema } from "../../../../lib/interfaces/http";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: Context) {
  try { return json(await service().read(idSchema.parse((await context.params).id), await viewerId())); }
  catch (error) { return handleCloudError(error); }
}
export async function PATCH(request: Request, context: Context) {
  try {
    const id = idSchema.parse((await context.params).id);
    const owner = await ownerId();
    const { visibility } = z.object({ visibility: visibilitySchema }).strict().parse(await jsonBody(request));
    await service().setVisibility(id, owner, visibility);
    return json({ ok: true });
  } catch (error) { return handleCloudError(error); }
}
export async function DELETE(_: Request, context: Context) {
  try {
    await service().archive(idSchema.parse((await context.params).id), await ownerId());
    return json({ ok: true });
  } catch (error) { return handleCloudError(error); }
}
