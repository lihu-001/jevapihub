import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return <main className="home-page">
    <header className="home-top">
      <Link className="home-brand" href="/" aria-label="Jev Interface Hub 首页"><span className="brand-mark" aria-hidden="true">J</span><strong>Jev</strong><span>Interface Hub</span></Link>
      <nav aria-label="主导航"><Link href="/hub">浏览 Hub</Link><Link href="/me/interfaces">我的 Interface</Link><Link href="/login">登录</Link></nav>
    </header>
    <section className="home-hero">
      <div className="home-intro">
        <span className="eyebrow">一个 Runtime · 无限 Interface</span>
        <h1>把判断任务，定义为可运行的 Interface。</h1>
        <p>输入 State，定义问题，立即运行。每个结果都能追溯到完整的请求与响应 JSON。</p>
        <Link className="button button-primary home-cta" href="/builder/new">打开 Builder <span aria-hidden="true">↗</span></Link>
      </div>
      <div className="home-art"><Image src="/signal-architecture.webp" alt="多层透明数据平面与发光信号线交汇，象征从输入到判断的过程" fill sizes="(max-width: 900px) 100vw, 50vw" priority /></div>
    </section>
    <section className="home-flow" aria-label="使用步骤">
      <div><span>01 / DEFINE</span><strong>填写 State 与问题</strong><p>把要判断的上下文和规则写清楚。</p></div>
      <div><span>02 / RUN</span><strong>运行 Interface</strong><p>用自己的 API Key 直接验证。</p></div>
      <div><span>03 / INSPECT</span><strong>查看结果与详情</strong><p>检查答案，也检查每一次请求。</p></div>
    </section>
    <section className="home-workspace">
      <div className="home-workspace-heading"><h2>想法到结果，都在同一个工作区。</h2><p>State、Questions 和运行结果同时在场。修改参数，再运行一遍，立即看到差异。</p></div>
      <div className="home-product">
        <Image className="home-product-desktop" src="/builder-workspace.png" alt="Jev Interface Hub Builder 的 State、Questions 与运行结果三栏工作区" width={1440} height={900} sizes="(max-width: 520px) 1px, 85vw" />
        <Image className="home-product-mobile" src="/builder-result-mobile.png" alt="Builder 运行结果示例：部门判断、评分和紧急程度" width={550} height={790} sizes="(max-width: 520px) 100vw, 1px" />
      </div>
    </section>
    <footer className="home-footer"><strong>Jev / Interface Hub</strong><span>定义 · 运行 · 验证</span></footer>
  </main>;
}
