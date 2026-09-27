import { z } from "zod";
import { getDatabase } from "../../../../../db/database";
import { createHubService } from "../../../../../lib/hub/service";
import { handleCloudError, json, viewerId } from "../../../../../lib/interfaces/http";

type Context = { params: Promise<{ owner: string; slug: string }> };

export async function GET(_: Request, context: Context) {
  try {
    const { owner, slug } = await context.params;
    const detail = await createHubService(getDatabase()).detail(z.uuid().parse(owner), z.string().min(1).max(120).parse(slug), await viewerId());
    return json(detail);
  } catch (error) { return handleCloudError(error); }
}
