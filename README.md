# Jev Interface Hub

这是通用 TypeSafe/Jev Interface Runtime 与游客 Playground。产品与技术要求见 `Jev_Interface_Hub_PRD_Technical_Spec.md`，Manifest 的标准结构见 `jev-interface-manifest.schema.json`。

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
npm run test:e2e
npm run build
```

游客可打开 `/builder/new` 或 `/playground` 创建并运行 Manifest，也可在本机保存、导入和导出 JSON。`POST /api/runtime/playground` 将请求转给固定的 TypeSafe System One 端点。TypeSafe API Key 默认只留在页面内存；勾选会话记住后才写入 `sessionStorage`。数据库没有 Key、state 或 raw answer 字段。云端保存、登录和发布属于后续阶段。
