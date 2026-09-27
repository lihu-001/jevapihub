import { z } from "zod";
import { generateExport } from "../../../../../../../../lib/export/generate";
import { handleCloudError, idSchema, service, viewerId } from "../../../../../../../../lib/interfaces/http";

type Context = { params: Promise<{ id: string; versionId: string; format: string }> };
const formatSchema = z.enum(["manifest", "python", "typescript", "curl"]);

export async function GET(_: Request, context: Context) {
  try {
    const { id, versionId, format } = await context.params;
    const saved = await service().getVersion(idSchema.parse(id), idSchema.parse(versionId), await viewerId());
    const exportFile = generateExport(saved.version.manifestJson, formatSchema.parse(format));
    return new Response(exportFile.content, { headers: {
      "Cache-Control": "no-store", "Content-Type": `${exportFile.contentType}; charset=utf-8`,
      "Content-Disposition": `attachment; filename="${exportFile.filename}"`,
    } });
  } catch (error) { return handleCloudError(error); }
}
