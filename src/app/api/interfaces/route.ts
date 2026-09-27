import { handleCloudError, json, jsonBody, manifestBodySchema, ownerId, service } from "../../../lib/interfaces/http";
import { getDatabase } from "../../../db/database";
import { createHubService } from "../../../lib/hub/service";
import { z } from "zod";

const filtersSchema = z.object({
  search: z.string().max(120).optional(), category: z.string().max(64).optional(), tag: z.string().max(64).optional(),
  language: z.string().max(32).optional(), sort: z.enum(["latest", "runs", "stars", "featured"]).optional(),
  featured: z.enum(["true", "false"]).optional(), page: z.coerce.number().int().min(1).max(1000).optional(),
});

export async function GET(request: Request) {
  try {
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const filters = filtersSchema.parse(params);
    return json({ interfaces: await createHubService(getDatabase()).list({ ...filters, featured: filters.featured === "true" }) });
  } catch (error) { return handleCloudError(error); }
}

export async function POST(request: Request) {
  try {
    const owner = await ownerId();
    const body = manifestBodySchema.parse(await jsonBody(request));
    const project = await service().create(owner, body.manifest, body.aiGenerated);
    return json({ interface: project }, 201);
  } catch (error) { return handleCloudError(error); }
}
