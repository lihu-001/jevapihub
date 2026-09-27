import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminPanel } from "../../../components/admin/admin-panel";
import { getDatabase } from "../../../db/database";
import { createAdminService } from "../../../lib/admin/service";
import { getCurrentUserId } from "../../../lib/auth/current-user";
import { InterfaceError } from "../../../lib/interfaces/service";

export default async function AdminInterfacesPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");
  const admin = createAdminService(getDatabase());
  const [interfaces, categories, overview] = await Promise.all([
    admin.listInterfaces(userId), admin.categories(userId), admin.overview(userId),
  ]).catch((error: unknown) => {
    if (error instanceof InterfaceError && error.status === 403) notFound();
    throw error;
  });
  return <main className="content-page admin-page"><nav><Link href="/hub">← Interface Hub</Link></nav>
    <span className="eyebrow">ADMIN</span><h1>Interface 管理</h1>
    <p className="field-hint">运行统计只包含汇总元数据，不包含 API Key、输入正文或原始答案。</p>
    <div className="stats-grid"><div><strong>{overview.totalRuns}</strong><span>总运行</span></div>
      <div><strong>{overview.successRuns}</strong><span>成功运行</span></div><div><strong>{overview.avgLatencyMs} ms</strong><span>平均耗时</span></div>
      <div><strong>{overview.inputTokens}</strong><span>输入 tokens</span></div><div><strong>{overview.outputTokens}</strong><span>输出 tokens</span></div></div>
    <AdminPanel interfaces={interfaces} categories={categories} />
  </main>;
}
