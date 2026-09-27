import { z } from "zod";
import { getDatabase } from "../../../../db/database";
import { createAdminService } from "../../../../lib/admin/service";
import { handleCloudError, json, jsonBody, ownerId } from "../../../../lib/interfaces/http";

const categorySchema = z.object({ slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(64),
  name: z.string().trim().min(1).max(120), enabled: z.boolean().default(true), sortOrder: z.number().int().min(-1000).max(1000).default(0),
}).strict();

export async function GET() {
  try { const userId = await ownerId(); return json({ categories: await createAdminService(getDatabase()).categories(userId) }); }
  catch (error) { return handleCloudError(error); }
}
export async function POST(request: Request) {
  try {
    const userId = await ownerId();
    const category = categorySchema.parse(await jsonBody(request));
    await createAdminService(getDatabase()).upsertCategory(userId, category);
    return json({ category });
  } catch (error) { return handleCloudError(error); }
}
