# Write Skills

面向提示词写作的现代化全栈编辑器。前端使用 Vite、React、TypeScript、Tiptap、Tailwind CSS 与 shadcn/ui 风格组件；后端和静态资源统一部署到 Cloudflare Workers，数据保存在 Cloudflare D1。

## 功能

- 沉浸式 Tiptap 富文本编辑器，支持标题、列表、任务列表、引用、代码、高亮与对齐。
- 防抖自动保存，保存状态实时反馈。
- 提示词搜索、收藏、标签、模型与 Temperature 参数。
- 自动识别 `{{variable}}` 变量。
- 手动版本快照、复制、克隆、删除及 TXT/JSON 导出。
- 深色/浅色主题。
- 可选的应用访问密码，使用 HttpOnly、Secure、SameSite Cookie。
- D1 参数化查询、迁移文件、外键级联删除及常用索引。
- GitHub Actions 自动建库、迁移、构建和部署。
- 每次 Action 开始自动记录 Run ID，并把最近 10 次运行状态保存到 Artifact 与 `run-history` 分支。

## 部署

在仓库 **Settings → Secrets and variables → Actions** 中配置：

| Secret | 必需 | 说明 |
|---|---:|---|
| `CLOUDFLARE_API_TOKEN` | 是 | 建议创建仅限目标账户的 Workers 编辑 Token，并包含 D1 编辑权限。 |
| `CLOUDFLARE_ACCOUNT_ID` | 是 | Cloudflare Account ID。 |
| `APP_PASSWORD` | 否 | 应用访问密码。未配置时应用默认开放，建议改用 Cloudflare Access 保护。 |

推送到 `main` 后，`.github/workflows/deploy.yml` 会自动：

1. 记录本次 GitHub Run ID 和运行链接。
2. 安装依赖并执行 TypeScript 检查。
3. 查找 `write-skills-db`；不存在时在 APAC 自动创建。
4. 将 D1 ID 写入构建时的 `wrangler.jsonc`。
5. 构建 React SPA 与 Worker。
6. 应用 `migrations/` 中尚未执行的迁移。
7. 部署到 Cloudflare Workers。
8. 写入可选的 `APP_PASSWORD` Worker Secret。
9. 保存最近 10 次运行状态。

> `wrangler.jsonc` 中的占位数据库 ID 不需要手工提交真实值。部署 Action 会在 Runner 内替换，避免把环境资源 ID 固化到源码工作流中。

## 本地开发

```bash
npm install

# 登录 Cloudflare，并自动创建/解析 D1 后写入本地 wrangler.jsonc
npx wrangler login
npm run cf:prepare

# 初始化本地数据库
npm run d1:migrate:local

# 启动 React + Worker + D1 本地环境
npm run dev
```

本地密码可写入 `.dev.vars`：

```dotenv
APP_PASSWORD=your-local-password
```

## 项目结构

```text
.github/actions/record-run/   Run ID 与近期状态记录 Action
.github/workflows/deploy.yml  Cloudflare 自动部署流水线
migrations/                  D1 SQL 迁移
scripts/prepare-cloudflare.mjs 自动创建/解析 D1
src/                         React、Tiptap 与 UI
worker/index.ts               Worker API、鉴权与 D1 数据访问
wrangler.jsonc                Worker、Assets 与 D1 绑定
```

## 官方参考

- Vite React TypeScript：<https://vite.dev/guide/>
- Tiptap React：<https://tiptap.dev/docs/editor/getting-started/install/react>
- Tailwind CSS Vite：<https://tailwindcss.com/docs/installation/using-vite>
- shadcn/ui Vite：<https://ui.shadcn.com/docs/installation/vite>
- Cloudflare Vite Plugin：<https://developers.cloudflare.com/workers/vite-plugin/>
- Cloudflare D1 migrations：<https://developers.cloudflare.com/d1/reference/migrations/>
- Cloudflare GitHub Actions：<https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/>
