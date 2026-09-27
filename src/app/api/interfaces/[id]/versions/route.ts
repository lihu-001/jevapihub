import { handleCloudError, idSchema, json, service, viewerId } from "../../../../../lib/interfaces/http";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: Context) {
  try { return json({ versions: await service().listVersions(idSchema.parse((await context.params).id), await viewerId()) }); }
  catch (error) { return handleCloudError(error); }
}
