import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SavedRunner } from "../../../../../../components/credentials/saved-runner";
import { getCurrentUserId } from "../../../../../../lib/auth/current-user";
import { service } from "../../../../../../lib/interfaces/http";
import { InterfaceError } from "../../../../../../lib/interfaces/service";

export default async function MyVersionPage({ params }: { params: Promise<{ id: string; versionId: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");
  const { id, versionId } = await params;
  const project = await service().getVersion(id, versionId, userId).catch((error: unknown) => {
    if (error instanceof InterfaceError && error.status === 404) notFound();
    throw error;
  });
  if (project.interface.ownerId !== userId) notFound();
  return <main className="content-page"><nav><Link href={`/me/interfaces/${id}`}>← 版本历史</Link></nav>
      <span className="eyebrow">PUBLISHED VERSION</span><h1>{project.interface.name} · v{project.version.versionNumber}</h1>
      <div className="saved-runner"><SavedRunner manifest={project.version.manifestJson} interfaceId={id} versionId={versionId} /></div>
    </main>;
}
