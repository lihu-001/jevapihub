import Link from "next/link";

export default function Home() {
  return <main className="home-page">
    <div className="home-top"><strong>Jev Interface Hub</strong><span>Manifest Studio</span></div>
    <div className="home-intro">
      <span className="eyebrow">一个 Runtime · 无限 Interface</span>
      <h1>把判断任务，定义为可运行的 Interface。</h1>
      <p>设计输入、State 与 Jev 问题，使用你自己的 TypeSafe API Key 即时试运行。Manifest 可以保存在本机并导出为 JSON。</p>
      <Link className="button button-primary" href="/builder/new">打开 Builder <span aria-hidden="true">↗</span></Link>
    </div>
    <div className="home-steps" aria-label="使用步骤">
      <div><span>01 / DEFINE</span><strong>描述输入与问题</strong></div>
      <div><span>02 / PREVIEW</span><strong>检查实际 State</strong></div>
      <div><span>03 / RUN</span><strong>调用 TypeSafe</strong></div>
    </div>
  </main>;
}
