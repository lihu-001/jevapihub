import { handleCloudError, json, jsonBody, manifestBodySchema, ownerId, service } from "../../../lib/interfaces/http";

export async function POST(request: Request) {
  try {
    const owner = await ownerId();
    const body = manifestBodySchema.parse(await jsonBody(request));
    const project = await service().create(owner, body.manifest, body.aiGenerated);
    return json({ interface: project }, 201);
  } catch (error) { return handleCloudError(error); }
}
