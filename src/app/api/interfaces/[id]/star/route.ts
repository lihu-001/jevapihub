import { getDatabase } from "../../../../../db/database";
import { createHubService } from "../../../../../lib/hub/service";
import { handleCloudError, idSchema, json, ownerId } from "../../../../../lib/interfaces/http";

type Context = { params: Promise<{ id: string }> };

export async function POST(_: Request, context: Context) {
  try { const userId = await ownerId(); await createHubService(getDatabase()).star(idSchema.parse((await context.params).id), userId); return json({ starred: true }); }
  catch (error) { return handleCloudError(error); }
}
export async function DELETE(_: Request, context: Context) {
  try { const userId = await ownerId(); await createHubService(getDatabase()).unstar(idSchema.parse((await context.params).id), userId); return json({ starred: false }); }
  catch (error) { return handleCloudError(error); }
}
