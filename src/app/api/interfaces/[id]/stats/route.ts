import { getDatabase } from "../../../../../db/database";
import { handleCloudError, idSchema, json, ownerId } from "../../../../../lib/interfaces/http";
import { getInterfaceStats } from "../../../../../lib/stats/service";

type Context = { params: Promise<{ id: string }> };
export async function GET(_: Request, context: Context) {
  try {
    const userId = await ownerId();
    return json(await getInterfaceStats(getDatabase(), idSchema.parse((await context.params).id), userId));
  } catch (error) { return handleCloudError(error); }
}
