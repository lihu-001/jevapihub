import { handleCloudError, json, ownerId, service } from "../../../../lib/interfaces/http";

export async function GET() {
  try { return json({ interfaces: await service().listMine(await ownerId()) }); }
  catch (error) { return handleCloudError(error); }
}
