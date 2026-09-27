# 给编码 AI 的启动提示词

你正在开发 **Jev Interface Hub**。

首先完整阅读：

1. `Jev_Interface_Hub_PRD_Technical_Spec.md`
2. `jev-interface-manifest.schema.json`

这两份文件是产品和技术需求的唯一主规格。不要自行把系统改造成“每种业务一个脚本”。

## 核心不可违反原则

1. 一个通用 Runtime + N 个 Interface Manifest。
2. TypeSafe/Jev 调用使用用户自己的 API Key。
3. TypeSafe API Key 不写入数据库、Cookie、localStorage、日志、监控事件或导出文件。
4. 默认 Key 仅存在浏览器内存；用户主动选择时才使用 sessionStorage。
5. 游客可以浏览和运行公共 Interface；登录只用于云端保存、版本、Fork、Star、发布等。
6. Published Interface Version 不可修改；编辑发生在 Draft，新发布创建新版本。
7. Saved Interface 运行时，questions 必须由服务器根据 version manifest 加载，客户端只能提交 inputs，不能覆盖 questions。
8. State 使用声明式 `$input` 模板解析，禁止 eval/new Function。
9. Postprocess 必须声明式，禁止执行用户 JavaScript/Python/Shell。
10. Runtime 上游 URL 固定为 TypeSafe System One API，禁止成为 arbitrary HTTP proxy。
11. 默认不保存用户 runtime state 或 raw answer。
12. 所有外部输入必须验证；TypeSafe 返回也必须验证。

## 开发方式

必须按 PRD 的 Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 逐阶段开发。

不要一次性生成整个项目然后声称完成。

每个 Phase 开始时：

- 先给出该 Phase 的文件级 implementation plan；
- 指明会新增/修改哪些文件；
- 指明数据库 migration；
- 指明测试。

每个 Phase 完成时必须执行并报告：

- typecheck
- lint
- unit tests
- integration tests（适用时）
- E2E（适用时）

发现测试失败必须修复，不允许仅说明“以后修”。

## 推荐技术栈

- Next.js App Router + TypeScript strict
- React
- Tailwind CSS
- shadcn/ui（或等价组件）
- PostgreSQL
- Drizzle ORM
- OAuth Auth（GitHub + Google）
- Zod + JSON Schema
- Vitest
- Playwright

实现时使用当前稳定版本，但不要为追求最新版本改变需求模型。

## 第一个开发目标：Phase 0

先完成：

1. 项目初始化；
2. Manifest TypeScript types；
3. 从 `jev-interface-manifest.schema.json` 接入校验；
4. semantic validator；
5. `$input` state resolver；
6. TypeSafe HTTP adapter；
7. TypeSafe response parser；
8. secret redaction；
9. weighted_score postprocess；
10. unit tests。

Phase 0 暂时不要做漂亮 UI，也不要做 Marketplace。

## TypeSafe 当前 HTTP 契约

上游固定：

`POST https://api.typesafe.ai/v1/systemone`

Header：

`Authorization: Bearer <USER_TYPESAFE_API_KEY>`

Body：

```json
{
  "state": {},
  "model": "jev-latest",
  "questions": {}
}
```

Question 类型：

- `noul`
- `choice`
- `score`

Choice criteria 最多 255 options；Score 2~10 levels。

不要凭记忆实现；遇到 API 契约疑问时，以 TypeSafe 官方当前文档为准。

## Secret Leak 自动测试

必须在 Phase 0/1 就建立一个测试：

测试 Key：

`TEST_SECRET_TYPESAFE_KEY_DO_NOT_STORE_123456`

完成模拟 Runtime 后扫描：

- DB
- logger capture
- response snapshots
- export files

必须 0 命中。

## 业务特殊逻辑禁止

不得写：

```ts
if (interfaceName === "AI味检测") { ... }
if (interfaceName === "标题评分") { ... }
```

所有业务差异只能来自 Manifest。

现在先：

1. 阅读规格；
2. 输出 Phase 0 implementation plan；
3. 等待/或直接按环境要求开始实现 Phase 0。
