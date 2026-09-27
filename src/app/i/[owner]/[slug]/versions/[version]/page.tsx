import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { z } from "zod";
import { SavedRunner } from "../../../../../../components/credentials/saved-runner";
import { getDatabase } from "../../../../../../db/database";
import * as schema from "../../../../../../db/schema";
import { getCurrentUserId } from "../../../../../../lib/auth/current-user";
import { createHubService } from "../../../../../../lib/hub/service";
import { InterfaceError } from "../../../../../../lib/interfaces/service";
import { parseManifest } from "../../../../../../lib/manifest/validate";

export default async function HubVersionPage({ params }: { params: Promise<{ owner: string; slug: string; version: string }> }) {
  const { owner, slug, version: rawVersion } = await params;
  const parsedVersion = z.coerce.number().int().min(1).max(1000000).safeParse(rawVersion);
  if (!z.uuid().safeParse(owner).success || !z.string().min(1).max(120).safeParse(slug).success || !parsedVersion.success) notFound();
  const db = getDatabase();
  const detail = await createHubService(db).detail(owner, slug, await getCurrentUserId()).catch((error: unknown) => {
    if (error instanceof InterfaceError && error.status === 404) notFound();
    throw error;
  });
  const [version] = await db.select().from(schema.interfaceVersions).where(and(eq(schema.interfaceVersions.interfaceId, detail.interface.id),
    eq(schema.interfaceVersions.versionNumber, parsedVersion.data))).limit(1);
  if (!version) notFound();
  const manifest = parseManifest(version.manifestJson);
  return <main className="content-page"><nav><Link href={`/i/${owner}/${slug}`}>← {detail.interface.name}</Link></nav>
    <span className="eyebrow">HISTORICAL VERSION</span><h1>{detail.interface.name} · v{version.versionNumber}</h1>
    <p className="field-hint">这个版本是不可修改的发布快照。使用你自己的 TypeSafe API Key 试运行。</p>
    <div className="saved-runner"><SavedRunner manifest={manifest} interfaceId={detail.interface.id} versionId={version.id} /></div>
  </main>;
}
