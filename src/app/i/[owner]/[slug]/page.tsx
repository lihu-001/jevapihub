import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDatabase } from "../../../../db/database";
import * as schema from "../../../../db/schema";
import { SavedRunner } from "../../../../components/credentials/saved-runner";
import { HubActions } from "../../../../components/hub/hub-actions";
import { getCurrentUserId } from "../../../../lib/auth/current-user";
import { createHubService } from "../../../../lib/hub/service";
import { InterfaceError } from "../../../../lib/interfaces/service";

export default async function HubDetailPage({ params }: { params: Promise<{ owner: string; slug: string }> }) {
  const { owner, slug } = await params;
  if (!z.uuid().safeParse(owner).success || !z.string().min(1).max(120).safeParse(slug).success) notFound();
  const userId = await getCurrentUserId();
  const db = getDatabase();
  const hub = createHubService(db);
  const detail = await hub.detail(owner, slug, userId).catch((error: unknown) => {
    if (error instanceof InterfaceError && error.status === 404) notFound();
    throw error;
  });
  const { manifestJson: manifest } = detail.version;
  const [viewer] = userId ? await db.select({ role: schema.users.role }).from(schema.users).where(eq(schema.users.id, userId)).limit(1) : [];
  const versions = await db.select({ id: schema.interfaceVersions.id, versionNumber: schema.interfaceVersions.versionNumber })
    .from(schema.interfaceVersions).where(eq(schema.interfaceVersions.interfaceId, detail.interface.id));
  return <main className="content-page hub-detail">
    <nav className="content-nav"><Link href="/hub">← Interface Hub</Link><Link href="/builder/new">创建 Interface</Link></nav>
    <span className="eyebrow">{detail.interface.featured ? "FEATURED / " : ""}{detail.interface.category} / {detail.interface.language}</span>
    <h1>{detail.interface.name}</h1><p>{detail.interface.description}</p>
    <p className="field-hint">作者 {detail.owner?.name || "匿名作者"} · v{detail.version.versionNumber} · {manifest.runtime.model} · {detail.runCount} 次运行 · {detail.starCount} 次收藏</p>
    <HubActions interfaceId={detail.interface.id} versionId={detail.version.id} signedIn={!!userId} initialStarred={detail.starred} initialFeatured={detail.interface.featured} admin={viewer?.role === "admin"} />
    <section id="try-it"><h2>Try it</h2><p className="field-hint">使用你自己的 TypeSafe API Key；运行内容不会保存到 Hub。</p><div className="saved-runner"><SavedRunner manifest={manifest} interfaceId={detail.interface.id} versionId={detail.version.id} /></div></section>
    <section id="questions"><h2>Questions</h2>{manifest.resultView.order.map((id) => <article className="result-block" key={id}><h3>{id} · {manifest.questions[id]?.type}</h3><p>{typeof manifest.questions[id]?.instructions === "string" ? manifest.questions[id].instructions as string : JSON.stringify(manifest.questions[id]?.instructions)}</p></article>)}</section>
    <section id="manifest"><h2>Manifest</h2><details><summary>查看完整 JSON</summary><pre className="hub-json">{JSON.stringify(manifest, null, 2)}</pre></details></section>
    <section id="versions"><h2>Versions</h2><ul>{versions.sort((a, b) => b.versionNumber - a.versionNumber).map((version) => <li key={version.id}>v{version.versionNumber}{version.id === detail.version.id ? " · 当前发布" : ""}</li>)}</ul></section>
    <section id="examples"><h2>Examples</h2>{manifest.examples?.length ? <pre className="hub-json">{JSON.stringify(manifest.examples, null, 2)}</pre> : <p>暂无示例。</p>}</section>
    <section id="download"><h2>Download</h2><div className="hub-actions">
      {(["manifest", "python", "typescript", "curl"] as const).map((format) => <a className="button" key={format} href={`/api/interfaces/${detail.interface.id}/versions/${detail.version.id}/export/${format}`}>{format === "manifest" ? "Manifest JSON" : format === "typescript" ? "TypeScript" : format === "python" ? "Python" : "cURL"}</a>)}
    </div></section>
  </main>;
}
