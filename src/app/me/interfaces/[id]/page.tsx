import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUserId } from "../../../../lib/auth/current-user";
import { service } from "../../../../lib/interfaces/http";
import { InterfaceError } from "../../../../lib/interfaces/service";

export default async function InterfaceHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");
  const id = (await params).id;
  const project = await service().read(id, userId).catch((error: unknown) => {
    if (error instanceof InterfaceError && error.status === 404) notFound();
    throw error;
  });
  if (project.interface.ownerId !== userId) notFound();
  const versions = await service().listVersions(id, userId);
  return <main className="content-page"><nav><Link href="/me/interfaces">← 我的 Interface</Link></nav>
      <span className="eyebrow">VERSION HISTORY</span><h1>{project.interface.name}</h1>
      <p className="muted">Draft 可继续编辑；已发布的每个版本都是独立快照。</p>
      <Link className="button button-primary" href={`/builder/${id}`}>编辑 Draft</Link>
      <Link className="button" href={`/me/interfaces/${id}/stats`}>查看运行统计</Link>
      <div className="project-list">{versions.map((version) => <article className="project-row" key={version.id}>
        <div><h2>v{version.versionNumber}</h2><small className="muted">{version.publishedAt.toLocaleString("zh-CN")}</small></div>
        <Link className="button button-small" href={`/me/interfaces/${id}/versions/${version.id}`}>查看并运行</Link>
      </article>)}</div>
    </main>;
}
