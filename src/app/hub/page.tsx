import Link from "next/link";
import { getDatabase } from "../../db/database";
import { createHubService, type HubSort } from "../../lib/hub/service";

type Query = { search?: string; category?: string; tag?: string; language?: string; sort?: string; featured?: string; page?: string };

export default async function HubPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const sort: HubSort = ["latest", "runs", "stars", "featured"].includes(query.sort || "") ? query.sort as HubSort : "featured";
  const page = Math.max(1, Math.min(1000, Number.parseInt(query.page || "1", 10) || 1));
  const filters = { search: query.search?.slice(0, 120), category: query.category?.slice(0, 64), tag: query.tag?.slice(0, 64),
    language: query.language?.slice(0, 32), sort, featured: query.featured === "true", page };
  const cards = await createHubService(getDatabase()).list(filters);
  const nextParams = new URLSearchParams(Object.entries(query).filter(([key, value]) => key !== "page" && value !== undefined) as [string, string][]);
  nextParams.set("page", String(page + 1));
  return <main className="hub-page">
    <nav className="content-nav"><Link className="brand" href="/">Jev / Interface Hub</Link><Link href="/builder/new">创建 Interface ↗</Link></nav>
    <div className="hub-heading"><span className="eyebrow">PUBLIC INTERFACES</span><h1>发现可以直接运行的判断接口。</h1><p>浏览公开版本，带上自己的 TypeSafe API Key 即可试运行。</p></div>
    <form className="hub-filters" action="/hub" method="get">
      <label className="field"><span>搜索</span><input name="search" defaultValue={filters.search || ""} maxLength={120} placeholder="名称或描述" /></label>
      <label className="field"><span>分类</span><input name="category" defaultValue={filters.category || ""} maxLength={64} placeholder="例如 general" /></label>
      <label className="field"><span>标签</span><input name="tag" defaultValue={filters.tag || ""} maxLength={64} /></label>
      <label className="field"><span>语言</span><input name="language" defaultValue={filters.language || ""} maxLength={32} placeholder="例如 zh-CN" /></label>
      <label className="field"><span>排序</span><select name="sort" defaultValue={sort}><option value="featured">精选优先</option><option value="latest">最新</option><option value="runs">运行最多</option><option value="stars">收藏最多</option></select></label>
      <label className="hub-check"><input name="featured" type="checkbox" value="true" defaultChecked={filters.featured} /> 只看精选</label>
      <button className="button button-primary" type="submit">筛选</button>
    </form>
    <div className="hub-grid">
      {cards.map((card) => <Link className="hub-card" href={`/i/${card.ownerId}/${card.slug}`} key={card.id}>
        <div className="hub-card-top"><span>{card.category} / {card.language}</span>{card.featured && <strong>FEATURED</strong>}</div>
        <h2>{card.name}</h2><p>{card.description || "暂无描述"}</p>
        <div className="hub-tags">{card.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
        <div className="hub-card-bottom"><span>by {card.ownerName || "匿名作者"} · v{card.versionNumber} · {card.model}</span><span>{card.runCount} 运行 · {card.starCount} 收藏</span></div>
      </Link>)}
    </div>
    {cards.length === 0 && <p className="notice">没有找到符合条件的公开 Interface。</p>}
    <div className="hub-pagination">{page > 1 && <Link className="button" href={`/hub?${new URLSearchParams({ ...Object.fromEntries(nextParams), page: String(page - 1) })}`}>上一页</Link>}{cards.length === 24 && <Link className="button" href={`/hub?${nextParams}`}>下一页</Link>}</div>
  </main>;
}
