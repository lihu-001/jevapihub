import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDatabase } from "../../../../../db/database";
import { getCurrentUserId } from "../../../../../lib/auth/current-user";
import { InterfaceError } from "../../../../../lib/interfaces/service";
import { getInterfaceStats } from "../../../../../lib/stats/service";

export default async function InterfaceStatsPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");
  const id = (await params).id;
  const stats = await getInterfaceStats(getDatabase(), id, userId).catch((error: unknown) => {
    if (error instanceof InterfaceError && error.status === 404) notFound();
    throw error;
  });
  return <main className="content-page"><nav><Link href={`/me/interfaces/${id}`}>← {stats.interface.name}</Link></nav>
    <span className="eyebrow">RUN STATISTICS</span><h1>运行统计</h1>
    <p className="field-hint">仅记录非敏感元数据；不保存输入正文、API Key 或原始答案。</p>
    <div className="stats-grid">
      <div><strong>{stats.totals.totalRuns}</strong><span>总运行</span></div>
      <div><strong>{stats.totals.successRuns}</strong><span>成功</span></div>
      <div><strong>{stats.totals.failedRuns}</strong><span>失败</span></div>
      <div><strong>{stats.totals.avgLatencyMs} ms</strong><span>平均耗时</span></div>
      <div><strong>{stats.totals.inputTokens}</strong><span>输入 tokens</span></div>
      <div><strong>{stats.totals.outputTokens}</strong><span>输出 tokens</span></div>
    </div>
    <section><h2>按版本</h2><table className="stats-table"><thead><tr><th>版本</th><th>运行</th><th>成功</th></tr></thead><tbody>
      {stats.versions.map((version) => <tr key={version.versionId}><td>v{version.versionNumber}</td><td>{version.totalRuns}</td><td>{version.successRuns}</td></tr>)}
    </tbody></table></section>
    <section><h2>最近 30 天</h2><table className="stats-table"><thead><tr><th>UTC 日期</th><th>运行</th><th>成功</th></tr></thead><tbody>
      {stats.daily.map((day) => <tr key={day.day}><td>{day.day}</td><td>{day.totalRuns}</td><td>{day.successRuns}</td></tr>)}
    </tbody></table>{!stats.daily.length && <p>最近 30 天没有运行记录。</p>}</section>
  </main>;
}
