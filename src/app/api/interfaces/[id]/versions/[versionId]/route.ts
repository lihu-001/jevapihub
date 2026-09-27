import { handleCloudError, idSchema, json, service, viewerId } from "../../../../../../lib/interfaces/http";

type Context = { params: Promise<{ id: string; versionId: string }> };

export async function GET(_: Request, context: Context) {
  try {
    const { id, versionId } = await context.params;
    return json(await service().getVersion(idSchema.parse(id), idSchema.parse(versionId), await viewerId()));
  } catch (error) { return handleCloudError(error); }
}
