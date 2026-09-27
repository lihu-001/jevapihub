import { handleCloudError, idSchema, json, jsonBody, manifestBodySchema, ownerId, service } from "../../../../../lib/interfaces/http";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Context) {
  try {
    const id = idSchema.parse((await context.params).id);
    const body = manifestBodySchema.parse(await jsonBody(request));
    await service().saveDraft(id, await ownerId(), body.manifest);
    return json({ ok: true });
  } catch (error) { return handleCloudError(error); }
}
