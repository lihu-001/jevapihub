import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "../../../components/credentials/sign-out-button";
import { getCurrentUserId } from "../../../lib/auth/current-user";
import { service } from "../../../lib/interfaces/http";

export default async function MyInterfacesPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");
  const projects = await service().listMine(userId);
  return <main className="content-page"><nav className="content-nav"><Link href="/">Jev Interface Hub</Link><SignOutButton /></nav>
    <div className="section-head"><div><span className="eyebrow">WORKSPACE</span><h1>我的 Interface</h1></div><Link className="button button-primary" href="/builder/new">＋ 新建</Link></div>
    {projects.length === 0 ? <p className="notice">还没有云端 Interface。可以先创建一个 Draft。</p>
      : <div className="project-list">{projects.map((project) => <article className="project-row" key={project.id}>
        <div><h2>{project.name}</h2><p className="muted">{project.description || project.slug}</p><small className="mono muted">{project.status} · {project.visibility}</small></div>
        <div className="header-actions"><Link className="button button-small" href={`/builder/${project.id}`}>编辑 Draft</Link><Link className="button button-small" href={`/me/interfaces/${project.id}`}>版本历史</Link></div>
      </article>)}</div>}
  </main>;
}
