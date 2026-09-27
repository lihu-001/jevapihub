"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function HubActions({ interfaceId, versionId, signedIn, initialStarred, initialFeatured, admin }: {
  interfaceId: string; versionId: string; signedIn: boolean; initialStarred: boolean; initialFeatured: boolean; admin: boolean;
}) {
  const router = useRouter();
  const [starred, setStarred] = useState(initialStarred);
  const [featured, setFeatured] = useState(initialFeatured);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  async function send(path: string, method: string, body?: unknown) {
    const response = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
    const data = await response.json() as { interface?: { id: string }; error?: { message?: string } };
    if (!response.ok) throw new Error(data.error?.message || "操作失败");
    return data;
  }
  async function action(work: () => Promise<void>) {
    setBusy(true); setStatus("");
    try { await work(); } catch (error) { setStatus(error instanceof Error ? error.message : "操作失败"); }
    finally { setBusy(false); }
  }
  return <div className="hub-actions">
    {signedIn ? <>
      <button className="button" type="button" disabled={busy} onClick={() => action(async () => { await send(`/api/interfaces/${interfaceId}/star`, starred ? "DELETE" : "POST"); setStarred(!starred); router.refresh(); })}>{starred ? "★ 已收藏" : "☆ 收藏"}</button>
      <button className="button" type="button" disabled={busy} onClick={() => action(async () => { const result = await send(`/api/interfaces/${interfaceId}/fork`, "POST", { versionId }); if (result.interface?.id) router.push(`/builder/${result.interface.id}`); })}>Fork 到我的 Draft</button>
      {admin && <button className="button" type="button" disabled={busy} onClick={() => action(async () => { await send(`/api/admin/interfaces/${interfaceId}/featured`, "PUT", { featured: !featured }); setFeatured(!featured); router.refresh(); })}>{featured ? "取消精选" : "设为精选"}</button>}
    </> : <a className="button" href="/login">登录后收藏或 Fork</a>}
    <span role="status" aria-live="polite">{status}</span>
  </div>;
}
