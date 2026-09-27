# Jev Interface Hub

这是通用 TypeSafe/Jev Interface Runtime 的 Phase 0 基础工程。产品与技术要求见 `Jev_Interface_Hub_PRD_Technical_Spec.md`，Manifest 的标准结构见 `jev-interface-manifest.schema.json`。

## 本地启动

需要 Node.js 20.9+；实际执行数据库 migration 时需要 PostgreSQL。

```powershell
npm install
npm run dev
```

使用 PostgreSQL 时，先在当前 shell 设置 `DATABASE_URL`，再运行 `npm run db:migrate`。迁移脚本记录文件哈希，拒绝修改已执行的 migration。集成测试使用嵌入式 PostgreSQL，无需本地数据库服务。

## 验证

```powershell
npm run typecheck
npm run lint
npm run test:unit
npm run test:integration
npm run build
```

Phase 0 通过 `src/lib/runtime/run.ts` 的 `runManifest()` 暴露 Runtime 核心函数。HTTP Runtime 路由和 Builder UI 属于 Phase 1。TypeSafe API Key 只作为调用时的临时参数传入；数据库没有 Key、state 或 raw answer 字段。
