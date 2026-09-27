# Jev Interface Hub

这是通用 TypeSafe/Jev Interface Runtime、游客 Playground 与云端 Interface 工作区。产品与技术要求见 `Jev_Interface_Hub_PRD_Technical_Spec.md`，Manifest 的标准结构见 `jev-interface-manifest.schema.json`。

## 本地启动

需要 Node.js 20.9+；实际执行数据库 migration 时需要 PostgreSQL。

```powershell
npm install
npm run dev
```

使用 PostgreSQL 时，先在当前 shell 设置 `DATABASE_URL`，再运行 `npm run db:migrate`。迁移脚本记录文件哈希，拒绝修改已执行的 migration。集成测试使用嵌入式 PostgreSQL，无需本地数据库服务。

云端功能需要设置 `AUTH_SECRET`、`NEXTAUTH_URL`，并配置 GitHub 或 Google OAuth Client ID/Secret。开发环境回调地址分别为 `http://localhost:3000/api/auth/callback/github` 和 `http://localhost:3000/api/auth/callback/google`。不同 Provider 的账号不会仅凭相同邮箱自动关联。

## 验证

```powershell
npm run typecheck
npm run lint
npm run test:unit
npm run test:integration
npm run test:e2e
npm run build
```

游客可打开 `/builder/new` 或 `/playground` 创建并运行 Manifest，也可在本机保存、导入和导出 JSON。登录用户可在 `/me/interfaces` 管理云端 Draft、发布不可变版本和查看历史。`POST /api/runtime/playground` 将请求转给固定的 TypeSafe System One 端点；Saved Runtime 从数据库加载版本 Manifest，只接受 `inputs`。TypeSafe API Key 默认只留在页面内存；勾选会话记住后才写入 `sessionStorage`。数据库没有 Key、state 或 raw answer 字段。
