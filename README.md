# Write Skills

一个面向长文本与结构化内容写作的轻量网页编辑器。界面采用类似 VS Code 的工作区布局，前端由 React 与 Tiptap 驱动，静态资源、API 和数据层统一运行在 Cloudflare Workers 与 D1 上。

## 主要能力

- 文件夹、文档树、标签页、命令面板和深浅色主题。
- Tiptap 富文本编辑，支持标题、列表、任务列表、引用、代码、高亮、链接、图片和文本对齐。
- 防抖自动保存与 `revision` 乐观并发控制，避免多个标签页静默覆盖远端内容。
- 收藏、搜索、回收站、复制文档、手动版本快照与版本恢复。
- Canonical Tiptap JSON、HTML 和纯文本三种内容表示，兼顾编辑、导出与搜索。
- 可选的共享访问密码，使用签名的 HttpOnly Cookie；也可以在外层使用 Cloudflare Access。
- 参数化 D1 查询、结构化错误响应、安全响应头和 Workers 可观测性。

## 技术栈

| 层级         | 技术                                                         |
| ------------ | ------------------------------------------------------------ |
| 构建与运行时 | Vite、TypeScript、Cloudflare Vite Plugin、Cloudflare Workers |
| 前端         | React、Tiptap、Tailwind CSS、shadcn/ui、Zustand              |
| 数据         | Cloudflare D1 / SQLite、Wrangler migrations                  |
| 测试         | Vitest、Testing Library、Cloudflare Workers Vitest Pool      |
| 交付         | GitHub Actions、Wrangler                                     |

## 架构

项目是一个单仓库、单 Worker 的同源应用：

1. 浏览器加载由 Workers Static Assets 托管的 Vite SPA。
2. `/api/*` 请求进入 `worker/index.ts`，完成同源校验、可选鉴权、参数校验和路由分发。
3. Worker 通过 `DB` binding 直接访问 D1，不经过 Cloudflare REST API。
4. `src/lib/contracts.ts` 定义前后端共享的数据契约；Zustand 只持有编辑会话和 UI 状态。
5. 文档更新必须携带客户端已知的 `expectedRevision`。版本不匹配时 API 返回 `409 revision_conflict`，客户端保留本地草稿并提示用户处理冲突。

关键目录：

```text
src/
  components/              编辑器、工作区外壳与 shadcn/ui 组件
  hooks/                   自动保存等交互逻辑
  lib/                     API 客户端、共享契约与工具
  stores/                  Zustand 编辑会话和 UI 状态
worker/
  db/                      参数化 D1 查询与事务
  routes/                  auth、folders、documents API
  auth.ts                  可选共享密码与签名 Cookie
  http.ts                  Problem Details、安全头与结构化日志
  index.ts                 Worker 入口
migrations/                顺序执行的 D1 SQL 迁移
tests/ui/                  浏览器侧单元与组件测试
tests/worker/              Workers runtime + D1 测试
.github/workflows/         PR CI 与手动 Cloudflare 发布
wrangler.jsonc             Assets、Worker、D1 与可观测性配置
```

## D1 数据模型

当前业务模型由 `migrations/0002_editor_schema.sql` 建立：

| 表                  | 用途                               | 重要约束                                                                 |
| ------------------- | ---------------------------------- | ------------------------------------------------------------------------ |
| `folders`           | 可嵌套的侧边栏文件夹               | `parent_id` 自引用；删除父文件夹时子项回到根级                           |
| `documents`         | 文档、内容、收藏、排序和回收站状态 | `content_json` 必须是有效 JSON；`revision >= 1`；`deleted_at` 实现软删除 |
| `document_versions` | 手动快照、恢复前快照和旧版迁移快照 | 外键级联到文档；记录来源 revision 与快照类型                             |

`migrations/0001_initial.sql` 中的 `prompts`、`prompt_versions` 是旧版结构。第二个迁移会把旧数据幂等地复制到新表，因此不能从已有数据库的迁移历史中删除或重排这两个文件。

常用查询已有以下索引：

- 文件夹：`(parent_id, position, name)`。
- 活跃文档、收藏与更新时间。
- 文件夹内文档的排序。
- 文档版本的时间倒序查询。

### 迁移原则

- 迁移文件一旦进入共享或生产环境，只新增，不修改、不重命名。
- 先在本地 D1 应用迁移并运行 Worker 测试，再提交 PR。
- 生产变更采用 expand/contract：先增加兼容字段或索引，代码稳定后再做清理。
- CI 使用 binding 名 `DB` 定位目标数据库，不把某个环境的数据库名或 ID 写死在命令中。
- 每个成功迁移都会长期改变数据库结构；回滚 Worker 版本不会自动撤销 D1 迁移。

创建迁移：

```bash
npx wrangler d1 migrations create write-skills-db <migration-name>
```

本地应用：

```bash
npm run d1:migrate:local
```

查看本地迁移状态：

```bash
npx wrangler d1 migrations list write-skills-db --local
```

远端迁移由部署工作流显式执行：

```bash
npx wrangler d1 migrations apply DB --remote
```

不要在 Worker 请求处理期间自动运行迁移。

## 本地开发

### 前置条件

- Node.js `>= 22.12`
- npm（使用仓库中的 `package-lock.json`）
- 仅在访问远端 Cloudflare 资源时需要 Wrangler 登录

安装依赖并初始化本地 D1：

```bash
npm ci
npm run d1:migrate:local
npm run types
npm run dev
```

Vite 与 Cloudflare 插件会同时启动 React、Worker 和本地 D1。默认情况下不会读取或写入生产数据库，本地状态保存在 `.wrangler/`。

`compatibility_date` 取本地开发、构建和 Worker 测试工具共同支持的近期日期。升级 `wrangler`、`@cloudflare/vite-plugin` 或 `@cloudflare/vitest-pool-workers` 后，应同步推进主配置与测试配置中的日期，重新运行 `npm run types`，并完整执行 Worker 测试、构建和 `npx wrangler deploy --dry-run`。

### 本地访问密码

项目默认不要求登录。需要测试登录流程时，把示例文件复制为 `.dev.vars`：

```bash
# macOS / Linux
cp .env.example .dev.vars

# PowerShell
Copy-Item .env.example .dev.vars
```

然后设置：

```dotenv
APP_PASSWORD="replace-with-a-long-password"
SESSION_SECRET="replace-with-a-random-session-secret"
```

可以使用 Node.js 生成随机 Session secret：

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

- 未设置或留空 `APP_PASSWORD`：应用开放访问。
- 设置 `APP_PASSWORD`：登录成功后签发带过期时间和随机 nonce 的签名 Cookie。
- 建议让 `SESSION_SECRET` 与访问密码不同，以便单独轮换会话密钥。
- 这是适合个人或小团队的共享密码，不是多用户账户系统。公开生产应用优先使用 Cloudflare Access。

`.dev.vars`、`.env`、Cloudflare Token 和真实密码都不能提交到 Git。

### 可选：准备个人远端 D1

如需从本机连接个人 Cloudflare 账户，可以执行：

```bash
npx wrangler login
npm run cf:prepare
```

该脚本会查找或创建默认 D1，并在当前工作树中临时替换 `wrangler.jsonc` 的数据库 ID。这个 ID 不是应用机密，但属于特定环境配置；不要把临时改写误提交到仓库。

## 质量检查与测试

| 命令                            | 作用                                              |
| ------------------------------- | ------------------------------------------------- |
| `npm run format:check`          | 检查 Prettier 格式                                |
| `npm run lint`                  | ESLint；Worker 代码额外检查 floating promises     |
| `npm run types:check`           | 验证 Wrangler 生成的 binding 类型没有漂移         |
| `npm run typecheck`             | 检查浏览器、Worker 和测试 TypeScript 工程         |
| `npm run test:ui`               | UI、store 与组件测试                              |
| `npm run test:worker`           | 在 Workers runtime 中运行 API、鉴权和本地 D1 测试 |
| `npm run test`                  | 运行全部测试                                      |
| `npm run test:coverage`         | 生成 UI 覆盖率报告                                |
| `npm run check`                 | 格式、lint、binding types、TypeScript 和全部测试  |
| `npm run build`                 | TypeScript 检查后构建 SPA 与 Worker               |
| `npx wrangler deploy --dry-run` | 生成部署包并校验 bindings，不上传                 |

提交前建议运行：

```bash
npm run check
npm run build
npx wrangler deploy --dry-run
```

## GitHub Actions

### PR CI

`.github/workflows/ci.yml` 在 pull request 和手动触发时执行：

1. `npm ci`
2. Prettier 格式检查
3. ESLint
4. Wrangler binding types 检查
5. TypeScript 工程检查
6. UI 与 Worker 测试
7. Vite / Worker 构建
8. `wrangler deploy --dry-run`

CI 只有 `contents: read` 权限，不需要 Cloudflare 凭据，也不会创建、迁移或部署远端资源。

### Staging 与 Production

`.github/workflows/deploy.yml` 只允许手动触发，并要求选择 `staging` 或 `production`。建议在仓库设置中建立同名的两个 GitHub Environments：

**Environment secrets**

| 名称                        |     必需 | 说明                                                            |
| --------------------------- | -------: | --------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`      |       是 | 限定目标 Account，至少具有 Workers Scripts Edit 与 D1 Edit 权限 |
| `CLOUDFLARE_ACCOUNT_ID`     |       是 | Cloudflare Account ID                                           |
| `CLOUDFLARE_D1_DATABASE_ID` |       是 | 该环境独立的 D1 UUID                                            |
| `ACCESS_PASSWORD`           |       否 | 共享访问密码；工作流会写入 Worker secret `APP_PASSWORD`         |
| `SESSION_SECRET`            | 条件必需 | 设置 `ACCESS_PASSWORD` 时必须同时提供，避免把密码直接当会话密钥 |

**Environment variables**

| 名称                          | 必需 | 说明                                         |
| ----------------------------- | ---: | -------------------------------------------- |
| `CLOUDFLARE_WORKER_NAME`      |   是 | 该环境独立的 Worker 名称                     |
| `CLOUDFLARE_D1_DATABASE_NAME` |   是 | 与 D1 ID 对应的数据库名称                    |
| `HEALTHCHECK_URL`             |   否 | 部署后的公开根 URL；设置后检查 `/api/health` |

推荐命名示例：

| 环境       | Worker                    | D1                           |
| ---------- | ------------------------- | ---------------------------- |
| staging    | `write-skills-staging`    | `write-skills-staging-db`    |
| production | `write-skills-production` | `write-skills-production-db` |

示例名称只是建议；真正的名称和数据库 ID 始终来自 GitHub Environment 配置。工作流只在临时 Runner 中更新 `wrangler.jsonc`，不会提交或打印数据库 ID。

为 `production` Environment 配置 required reviewers，并限制可以部署的分支。发布任务不会自动取消正在运行的同环境发布，避免两个迁移并发执行。

### 发布顺序

手动工作流会先在无 Cloudflare 权限的验证 job 中运行完整检查。Environment 获批后：

1. 校验必需的 secrets 和 variables。
2. 在临时工作树中注入目标 Worker 名、D1 名称与 D1 ID。
3. 重新构建并执行 Wrangler dry-run。
4. 运行 `wrangler d1 migrations apply DB --remote`。
5. 如有配置，通过一次 `wrangler secret bulk` 原子同步 `ACCESS_PASSWORD` 与
   `SESSION_SECRET`，避免逐个更新密钥产生部分发布状态。
6. 只有迁移和密钥同步成功才执行 `wrangler deploy`。
7. 如有 `HEALTHCHECK_URL`，重试检查 `/api/health`。

生产流程不会自动创建数据库，也不会因为 Secret 缺失而猜测目标，避免把 staging 数据库误绑定到 production。

确认本机 `wrangler.jsonc` 已绑定正确目标、Wrangler 已登录且远端 secrets 已配置后，也可以运行 `npm run deploy`。该命令同样严格按检查、构建、dry-run、远端迁移、正式部署的顺序执行，不会跳过 D1 migration。

> 将 GitHub 的 `ACCESS_PASSWORD` 留空不会自动删除 Cloudflare 上已经存在的 `APP_PASSWORD`，这是有意的防误操作设计。若要关闭密码保护，请在确认目标 Worker 后，从 Cloudflare Dashboard 显式删除 `APP_PASSWORD` secret。

## 回滚

### Worker 代码回滚

优先在 Cloudflare Dashboard 的 Worker Deployments 页面选择已知正常版本回滚。也可以使用 Wrangler：

```bash
npx wrangler versions list --name "$CLOUDFLARE_WORKER_NAME"
npx wrangler rollback <VERSION_ID> \
  --name "$CLOUDFLARE_WORKER_NAME" \
  --message "rollback after failed release" \
  --yes
```

也可以从已知正常的 Git commit 手动重新运行部署工作流，但必须先确认该版本仍兼容当前 D1 schema。

### D1 恢复

- 某个迁移执行失败时，Wrangler 会回滚该迁移；此前已成功的迁移仍然保留。
- Worker 版本回滚不会撤销已成功的 D1 迁移。
- 数据或 schema 需要恢复时，先停止进一步发布，并使用 D1 Time Travel 或 Cloudflare Dashboard 恢复到明确时间点。
- 破坏性迁移前先确认恢复窗口，并优先采用向前修复迁移，而不是手工修改 `d1_migrations`。

## 安全说明

- Cloudflare API Token 仅保存在 GitHub Environment secrets，不放进 `.env.example`、`.dev.vars` 或 Wrangler vars。
- D1 `database_id` 不是认证密钥，但仍按环境注入，避免错误绑定。
- Worker API 使用 prepared statements；不要添加可执行任意 SQL 的 HTTP 接口。
- Cookie 使用 HttpOnly、SameSite，并在 HTTPS 下启用 Secure。
- API 写请求执行同源校验，文档 revision 冲突不会被静默覆盖。
- Worker 日志不应记录密码、Cookie、完整文档内容或 Cloudflare 凭据。

## 官方参考

- [Cloudflare Vite Plugin](https://developers.cloudflare.com/workers/vite-plugin/)
- [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)
- [Workers CI/CD](https://developers.cloudflare.com/workers/ci-cd/)
- [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)
- [Wrangler commands](https://developers.cloudflare.com/workers/wrangler/commands/)
- [Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Tiptap React](https://tiptap.dev/docs/editor/getting-started/install/react)
- [shadcn/ui Vite](https://ui.shadcn.com/docs/installation/vite)
