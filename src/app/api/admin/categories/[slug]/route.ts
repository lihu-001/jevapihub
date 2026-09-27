import { z } from "zod";
import { getDatabase } from "../../../../../db/database";
import { createAdminService } from "../../../../../lib/admin/service";
import { handleCloudError, json, ownerId } from "../../../../../lib/interfaces/http";

type Context = { params: Promise<{ slug: string }> };

export async function DELETE(_: Request, context: Context) {
  try {
    const userId = await ownerId();
    const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(64).parse((await context.params).slug);
    await createAdminService(getDatabase()).removeCategory(userId, slug);
    return json({ ok: true });
  } catch (error) { return handleCloudError(error); }
}
