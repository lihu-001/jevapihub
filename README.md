# Jev Interface Hub

这是通用 TypeSafe/Jev Interface Runtime、游客 Playground 与云端 Interface 工作区。产品与技术要求见 `Jev_Interface_Hub_PRD_Technical_Spec.md`，Manifest 的标准结构见 `jev-interface-manifest.schema.json`。

## 本地启动

需要 Node.js 20.9+；实际执行数据库 migration 时需要 PostgreSQL。

```powershell
npm install
npm run dev
```

使用 PostgreSQL 时，在项目根目录的 `.env` 填写 `DATABASE_URL`（或在当前 shell 设置该变量），再运行 `npm run db:migrate`。迁移和种子脚本会读取 `.env`，但当前 shell 中已有的 `DATABASE_URL` 优先，方便指向独立测试库。迁移脚本记录文件哈希，拒绝修改已执行的 migration。集成测试使用嵌入式 PostgreSQL，无需本地数据库服务。

Manifest 校验器由 `jev-interface-manifest.schema.json` 预编译生成，浏览器端无需动态执行代码；修改 Schema 后运行 `npm run schema:generate`，提交更新后的 `src/lib/manifest/schema.generated.js`。`npm run build` 也会自动重新生成。

## Docker Compose 部署

Compose 适合单机部署：运行 PostgreSQL、执行数据库迁移，再启动 Next.js 生产服务。两份配置都使用 `postgres_data` 数据卷保存数据库，并默认只在宿主机 `127.0.0.1:3000` 提供应用服务，适合接入 Nginx、Caddy 等 HTTPS 反向代理。

| 文件 | 用途 |
| --- | --- |
| `docker-compose.yml` | 默认的最小配置：无需 `.env`，自动生成并保存数据库密码，启动数据库、迁移和应用；未设置 `AUTH_SECRET` 时仅提供游客功能。 |
| `docker-compose-sample.yml` | 完整配置示例：支持邮箱密码注册登录、AI Builder、运行限制等可选变量，并为数据库和应用设置自动重启策略。 |

### 前置条件

- Docker Engine；
- Docker Compose Plugin（命令为 `docker compose`）；
- 服务器至少保留约 2 GB 可用磁盘；2C2G 单机建议配置 1–2 GB swap；
- 如果与其他服务共用服务器，为 Next.js、PostgreSQL 和其他服务预留内存，避免构建时触发 OOM。

### 首次部署

复制项目到服务器，在项目根目录直接构建并启动最小配置，无需创建 `.env`：

```sh
docker compose up -d --build
```

首次启动会生成随机数据库密码，保存在 `db_credentials` 数据卷；后续启动沿用该密码。`POSTGRES_DB`、`POSTGRES_USER`、`APP_PORT` 可以按需通过环境变量覆盖。也可首次启动前设置 `POSTGRES_PASSWORD` 指定数据库密码；数据库初始化后不能更换密码而不同时修改数据库中的密码。最小配置不注入认证密钥，因此只提供公开页面与游客 Playground。
如需登录和发布，先创建 `.env` 并设置数据库密码、认证密钥和实际访问地址，再使用完整示例。若从最小配置切换，先从凭据卷中读取已有密码，填入 `.env` 的 `POSTGRES_PASSWORD`（不能重新生成）；两份配置使用同一 `postgres_data` 数据卷。

```sh
docker compose run --rm --no-deps --entrypoint cat db-credentials /run/jev-hub-db/password
cp .env.example .env
```

在 `.env` 中设置 `POSTGRES_PASSWORD`、`AUTH_SECRET`、`NEXTAUTH_URL` 后启动完整示例，无需第三方 OAuth。可选设置 `ADMIN_EMAIL` 和 `ADMIN_PASSWORD`；不设置 `ADMIN_PASSWORD` 时，首次迁移会随机生成管理员密码并只在迁移输出中打印一次。`NEXTAUTH_URL` 应为用户实际访问的地址。Compose 根据数据库变量生成容器内的 `DATABASE_URL`，无需填写 `.env` 中的 `DATABASE_URL`。

启用 AI Builder 时还需要设置 `AI_BUILDER_ENABLED=true` 和 `AI_BUILDER_API_KEY`。使用完整示例启动：

```sh
docker compose -f docker-compose-sample.yml up -d --build
```

完整示例还可在 `.env` 中设置 `APP_URL`、运行限制等可选变量；不使用 AI Builder 时保持 `AI_BUILDER_ENABLED=false`。下文命令以默认的最小配置为例；使用完整示例时，每条命令都在 `docker compose` 后加上 `-f docker-compose-sample.yml`，例如 `docker compose -f docker-compose-sample.yml ps`。

Compose 的启动顺序为：

```text
db-credentials（生成或读取数据库密码）→ db（等待 PostgreSQL 健康）
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

更新代码时，Compose 会重新构建应用镜像；已有的数据库 volume、已执行 migration 和已导入的接口都会保留。切换最小版与完整示例时须使用相同的数据库密码和数据库名，否则应用无法连接已有数据。不要修改已经执行过的 migration 文件。

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

生产环境不要提交 `.env`，也不要删除 `postgres_data` 或 `db_credentials` volume；删除凭据卷后，最小配置会重新生成密码，无法连接原数据库。

`/admin/interfaces` 供内置管理员账号管理公开 Interface、精选、隐藏与分类，并查看不含用户正文的运行汇总。新注册用户默认为 `user`；不要通过普通注册接口创建管理员。

云端功能需要 PostgreSQL、`AUTH_SECRET` 和 `NEXTAUTH_URL`。本地在 `.env` 中配置 `DATABASE_URL`、`AUTH_SECRET`、`NEXTAUTH_URL=http://localhost:3000`，执行 `npm run db:migrate` 后，迁移会幂等创建内置管理员账号（默认邮箱 `admin@jev-interface.local`）。可通过 `ADMIN_EMAIL` 修改邮箱、通过 `ADMIN_PASSWORD` 指定密码；不指定密码时随机生成，密码只在首次迁移输出中显示。然后访问 `/login` 登录或注册普通邮箱密码账号。生产环境需 HTTPS；密码以 bcrypt 哈希保存，登录和注册按进程限流，多实例部署需共享限流状态。

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

需要真实数据库的云端浏览器闭环测试使用**独立、可丢弃**的 PostgreSQL 测试库：设置 `E2E_DATABASE_URL`，对该库执行 `npm run db:migrate`（此命令读取 `DATABASE_URL`，请将其临时指向同一测试库），然后运行 `npm run test:e2e`。测试会在库中创建用户和不可变版本，不会清理这些记录；未设置 `E2E_DATABASE_URL` 时该组用例自动跳过。此测试使用签名测试会话验证云端流程；邮箱密码注册登录需另行验收。

游客可打开 `/builder/new` 或 `/playground` 创建并运行 Interface，也可在本机保存草稿。普通用户登录后可在 `/me/interfaces` 管理云端 Draft，但不能发布到 Hub。管理员在 `/admin/interfaces` 管理自己的 Hub Interface 并发布不可变版本。`POST /api/runtime/playground` 将请求转给固定的 TypeSafe System One 端点；Saved Runtime 从数据库加载版本 Manifest，只接受 `inputs`。TypeSafe API Key 默认只留在页面内存；勾选会话记住后才写入 `sessionStorage`。数据库没有 Key、state 或 raw answer 字段。

Builder 提供基础模式和 JSON 调试。基础模式分为 State 示例、Questions、预览与运行三栏；默认载入 Stripe 支付集成求助示例。State 和每个问题的 JSON 均可编辑，Questions 可添加 Noul、Choice、Score。保存或发布时，Builder 将 State 示例转换为一个可填写的 `content` 输入；Hub 访客可以替换示例内容运行同一版本的 Questions。发布面板展示 Hub 输入表单预览。运行区与 Hub 使用相同的 API Key 入口、答案和响应详情展示；基础模式的请求详情为只读，点击“在 JSON 调试中编辑”可修改请求。旧版本机草稿可通过“恢复旧草稿”手动载入。已有的不含输入字段的发布版本保持不可变，在 Hub 中会标明它使用固定 State；作者需发布新版本才能开放输入。

从 `/builder/new` 保存到本机或云端时会弹出标题（必填）和描述（选填）表单，保存后的名称与描述写入 Manifest，重新编辑时可修改。从 `/builder/new` 首次保存到云端会创建独立 Draft（默认 slug 自动分配唯一值），后续应在 `/builder/{id}` 继续保存；已有 Draft 可在 `/me/interfaces` 找回。仅保存 Draft 不会出现在公共 Hub，管理员需要发布并选择 Public。

公共 Hub 位于 `/hub`。游客和普通用户都可以浏览、筛选并试运行管理员发布的公开 Interface；不提供收藏或 Fork。普通用户登录后只能在 `/me/interfaces` 管理自己的数据库 Draft，不能将 Draft 发布到 Hub。管理员通过 `/admin/interfaces` 创建、编辑和发布 Hub Interface，设置 Featured、隐藏项目、管理分类并查看汇总统计。Unlisted 版本可通过详情链接访问，但不会进入公共搜索；Private 版本只有管理员作者可访问。保存版本的成功运行只记录版本 ID、模型、token 数与耗时等元数据，用于运行次数统计。

已有的 Manifest JSON、Python、TypeScript 和 cURL 生成接口仍可供其他流程使用；简化后的 Builder 页面不再提供导入、导出或测试集入口。作者可在 Interface 版本历史页查看总运行、成功/失败、耗时、token 和最近 30 天的统计。
