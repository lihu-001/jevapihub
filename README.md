# Jev Interface Hub

这是通用 TypeSafe/Jev Interface Runtime、游客 Playground 与云端 Interface 工作区。产品与技术要求见 `Jev_Interface_Hub_PRD_Technical_Spec.md`，Manifest 的标准结构见 `jev-interface-manifest.schema.json`。

## 本地启动

需要 Node.js 20.9+；实际执行数据库 migration 时需要 PostgreSQL。

```powershell
npm install
npm run dev
```

使用 PostgreSQL 时，先在当前 shell 设置 `DATABASE_URL`，再运行 `npm run db:migrate`。迁移脚本记录文件哈希，拒绝修改已执行的 migration。集成测试使用嵌入式 PostgreSQL，无需本地数据库服务。

## Docker Compose 部署

Compose 适合单机部署：运行 PostgreSQL、执行数据库迁移，再启动 Next.js 生产服务。两份配置都使用 `postgres_data` 数据卷保存数据库，并默认只在宿主机 `127.0.0.1:3000` 提供应用服务，适合接入 Nginx、Caddy 等 HTTPS 反向代理。

| 文件 | 用途 |
| --- | --- |
| `docker-compose.yml` | 默认的最小配置：数据库、迁移、应用，以及必需的环境变量；不传入 OAuth 或 AI Builder 配置，也未设置容器自动重启策略。 |
| `docker-compose-sample.yml` | 原有完整配置示例：增加 OAuth、AI Builder、运行限制等可选变量，并为数据库和应用设置自动重启策略。 |

### 前置条件

- Docker Engine；
- Docker Compose Plugin（命令为 `docker compose`）；
- 服务器至少保留约 2 GB 可用磁盘；2C2G 单机建议配置 1–2 GB swap；
- 如果与其他服务共用服务器，为 Next.js、PostgreSQL 和其他服务预留内存，避免构建时触发 OOM。

### 首次部署

复制项目到服务器，在项目根目录创建生产环境文件：

```sh
cp .env.example .env
```

两份 Compose 配置都要求在 `.env` 中设置以下变量：

```env
POSTGRES_PASSWORD=替换为数据库密码
AUTH_SECRET=替换为随机长密钥
NEXTAUTH_URL=https://你的域名
```

`POSTGRES_DB`、`POSTGRES_USER`、`APP_PORT` 可以使用默认值。`NEXTAUTH_URL` 应填写用户实际访问的地址；即使暂不启用登录，当前 Compose 配置也要求设置它。Compose 会根据数据库变量生成容器内的 `DATABASE_URL`，无需填写 `.env` 中的 `DATABASE_URL`。

使用最小配置构建并启动：

```sh
docker compose up -d --build
```

需要登录和发布时，在 `.env` 中设置 GitHub 或 Google 的 Client ID/Secret，并改用完整示例；启用 AI Builder 时还需要设置 `AI_BUILDER_ENABLED=true` 和 `AI_BUILDER_API_KEY`：

```sh
docker compose -f docker-compose-sample.yml up -d --build
```

完整示例还可在 `.env` 中设置 `APP_URL`、运行限制等可选变量；不使用 AI Builder 时保持 `AI_BUILDER_ENABLED=false`。下文命令以默认的最小配置为例；使用完整示例时，每条命令都在 `docker compose` 后加上 `-f docker-compose-sample.yml`，例如 `docker compose -f docker-compose-sample.yml ps`。

Compose 的启动顺序为：

```text
db（等待 PostgreSQL 健康）
  → migrate（执行未应用的 SQL migration）
    → app（启动 Next.js）
```

检查服务状态和日志：

```sh
docker compose ps
docker compose logs -f migrate
docker compose logs -f app
```

### 反向代理

应用默认地址为 `http://127.0.0.1:3000`。生产环境应由反向代理负责：

- HTTPS 证书；
- HTTP 到 HTTPS 跳转；
- 转发 `Host`、`X-Forwarded-For` 和 `X-Forwarded-Proto`；
- 支持至少 90 秒的上游读取超时，因为 Jev 请求可能等待外部 API 响应。

如果不使用反向代理，需要自行修改所用 Compose 文件的 `ports`，将本机绑定改为公网监听；不建议直接暴露未加密的生产服务。

### 迁移、种子和更新

`migrate` 是一次性服务。新增 migration 后重新部署即可：

```sh
docker compose up -d --build
```

需要时手动导入“中文文章模板腔评估”和“自媒体标题评分”两个官方示例（部署和迁移不会自动导入）：

```sh
docker compose run --rm migrate node scripts/seed.mjs
```

更新代码时，Compose 会重新构建应用镜像；已有的数据库 volume、已执行 migration 和已导入的接口都会保留。切换最小版与完整示例也不会清空同一 Compose 项目的数据库数据。不要修改已经执行过的 migration 文件。

### 停止与备份

停止容器但保留数据库：

```sh
docker compose down
```

备份数据库：

```sh
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > backup.sql
```

恢复数据库前先停止应用，然后将备份导入数据库：

```sh
docker compose stop app
cat backup.sql | docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"'
docker compose start app
```

删除数据库及其所有数据是破坏性操作：

```sh
docker compose down -v
```

生产环境不要提交 `.env`，也不要删除 `postgres_data` volume。

`/admin/interfaces` 供数据库中 `role=admin` 的登录用户管理公开 Interface、精选、隐藏与分类，并查看不含用户正文的运行汇总。普通 OAuth 用户默认为 `user`；管理员角色需由数据库管理员明确设置。

云端功能需要设置 `AUTH_SECRET`、`NEXTAUTH_URL`，并配置 GitHub 或 Google OAuth Client ID/Secret。开发环境回调地址分别为 `http://localhost:3000/api/auth/callback/github` 和 `http://localhost:3000/api/auth/callback/google`。不同 Provider 的账号不会仅凭相同邮箱自动关联。

Runtime 的每分钟请求数可用 `RUNTIME_RATE_LIMIT_GUEST` 和 `RUNTIME_RATE_LIMIT_USER` 配置，默认分别为 60 和 120。当前限流计数位于服务进程内，多实例部署需要接入共享限流存储。

AI Builder 需要 `AI_BUILDER_API_KEY`（平台 OpenAI Key），可设置 `AI_BUILDER_MODEL`、`AI_BUILDER_DAILY_LIMIT`，用 `AI_BUILDER_ENABLED=false` 关闭。仅登录用户可调用；每天按 UTC 日期对每位用户计数。AI 返回的 Manifest 先经过 JSON Schema 和业务规则校验，失败时自动修复一次。候选结果须在 Builder 中预览并手动应用，已发布版本不会被 AI 接口修改。

## 验证

```powershell
npm run typecheck
npm run lint
npm run test:unit
npm run test:integration
npm run test:e2e
npm run build
```

需要真实数据库的云端浏览器闭环测试使用**独立、可丢弃**的 PostgreSQL 测试库：设置 `E2E_DATABASE_URL`，对该库执行 `npm run db:migrate`（此命令读取 `DATABASE_URL`，请将其临时指向同一测试库），然后运行 `npm run test:e2e`。测试会在库中创建用户和不可变版本，不会清理这些记录；未设置 `E2E_DATABASE_URL` 时该组用例自动跳过。此测试使用签名测试会话验证云端流程；GitHub/Google 的真实 OAuth 回调仍需另行配置并验收。

游客可打开 `/builder/new` 或 `/playground` 创建并运行 Interface，也可在本机保存草稿。登录用户可在 `/me/interfaces` 管理云端 Draft、发布不可变版本和查看历史。`POST /api/runtime/playground` 将请求转给固定的 TypeSafe System One 端点；Saved Runtime 从数据库加载版本 Manifest，只接受 `inputs`。TypeSafe API Key 默认只留在页面内存；勾选会话记住后才写入 `sessionStorage`。数据库没有 Key、state 或 raw answer 字段。

Builder 提供基础模式和 JSON 调试。基础模式分为 State 示例、Questions、预览与运行三栏；默认载入 Stripe 支付集成求助示例。State 和每个问题的 JSON 均可编辑，Questions 可添加 Noul、Choice、Score。保存或发布时，Builder 将 State 示例转换为一个可填写的 `content` 输入；Hub 访客可以替换示例内容运行同一版本的 Questions。发布面板展示 Hub 输入表单预览。运行区与 Hub 使用相同的 API Key 入口、答案和响应详情展示；基础模式的请求详情为只读，点击“在 JSON 调试中编辑”可修改请求。旧版本机草稿可通过“恢复旧草稿”手动载入。已有的不含输入字段的发布版本保持不可变，在 Hub 中会标明它使用固定 State；作者需发布新版本才能开放输入。

公共 Hub 位于 `/hub`。公开版本支持搜索、筛选、排序、试运行和 Star；登录用户可以 Fork 指定版本到自己的 Draft。Unlisted 版本可通过详情链接访问，但不会进入公共搜索；Private 版本只有作者可访问。管理员可在详情页设置 Featured。保存版本的成功运行只记录版本 ID、模型、token 数与耗时等元数据，用于运行次数统计。

已有的 Manifest JSON、Python、TypeScript 和 cURL 生成接口仍可供其他流程使用；简化后的 Builder 页面不再提供导入、导出或测试集入口。作者可在 Interface 版本历史页查看总运行、成功/失败、耗时、token 和最近 30 天的统计。
