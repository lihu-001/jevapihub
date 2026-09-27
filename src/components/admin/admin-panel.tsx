"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Item = { id: string; name: string; slug: string; ownerId: string; ownerName: string | null; category: string;
  featured: boolean; adminHidden: boolean; updatedAt: Date };
type Category = { slug: string; name: string; enabled: boolean; sortOrder: number };

export function AdminPanel({ interfaces, categories }: { interfaces: Item[]; categories: Category[] }) {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  async function send(path: string, method: string, body?: unknown) {
    const response = await fetch(path, { method, cache: "no-store", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const data = await response.json() as { error?: { message?: string } };
    if (!response.ok) throw new Error(data.error?.message ?? "操作失败");
  }
  async function act(work: () => Promise<void>) {
    setBusy(true); setStatus("");
    try { await work(); router.refresh(); setStatus("已更新"); }
    catch (error) { setStatus(error instanceof Error ? error.message : "操作失败"); }
    finally { setBusy(false); }
  }
  return <>
    <section><h2>公开 Interface 与已隐藏项目</h2><div className="project-list">{interfaces.map((item) => <article className="project-row" key={item.id}>
      <div><h3>{item.name}</h3><p>{item.adminHidden ? "管理员已隐藏" : item.featured ? "公开 · Featured" : "公开"} · {item.category} · 作者 {item.ownerName || item.ownerId}</p></div>
      <div className="hub-actions">{!item.adminHidden && <a className="button button-small" href={`/i/${item.ownerId}/${item.slug}`}>查看</a>}
        <button className="button button-small" type="button" disabled={busy} onClick={() => act(() => send(`/api/admin/interfaces/${item.id}/hidden`, "PUT", { hidden: !item.adminHidden }))}>{item.adminHidden ? "恢复公开" : "隐藏"}</button>
      </div>
    </article>)}</div></section>
    <section><h2>分类</h2><form className="admin-category-form" onSubmit={(event) => { event.preventDefault(); void act(async () => { await send("/api/admin/categories", "POST", { slug, name, enabled, sortOrder }); setSlug(""); setName(""); }); }}>
      <label className="field"><span>Slug</span><input value={slug} onChange={(event) => setSlug(event.target.value)} required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={64} /></label>
      <label className="field"><span>名称</span><input value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} /></label>
      <label className="field"><span>排序</span><input type="number" value={sortOrder} min={-1000} max={1000} onChange={(event) => setSortOrder(Number(event.target.value))} /></label>
      <label className="hub-check"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> 启用</label>
      <button className="button button-primary" type="submit" disabled={busy}>保存分类</button>
    </form><div className="project-list">{categories.map((category) => <div className="project-row" key={category.slug}>
      <span>{category.name} · {category.slug} · {category.enabled ? "启用" : "停用"}</span><div className="hub-actions">
        <button className="button button-small" type="button" onClick={() => { setSlug(category.slug); setName(category.name); setEnabled(category.enabled); setSortOrder(category.sortOrder); }}>编辑</button>
        <button className="button button-small" type="button" disabled={busy} onClick={() => act(() => send(`/api/admin/categories/${category.slug}`, "DELETE"))}>删除</button>
      </div>
    </div>)}</div></section>
    <p role="status" aria-live="polite">{status}</p>
  </>;
}
