# 今天别硬撑（today-dont-push）

> **独立性声明**：本项目为完全独立的全新比赛项目，不依赖、不读取、不复制、不复用“织文”项目的任何代码。

## 当前状态

本轮仅建立**可运行、可测试的 TypeScript Monorepo 工程骨架**，不包含任何产品业务逻辑、AI 模型调用或正式 UI。

## 技术栈

- Node.js 当前 LTS、pnpm workspace
- 前端：React + TypeScript + Vite
- 后端：Fastify + TypeScript
- 契约：Zod
- 数据库：Drizzle ORM + PostgreSQL（仅预留结构，本轮无业务表）
- 质量：TypeScript strict、Vitest、ESLint

## 目录结构

```
today-dont-push/
├─ apps/
│  ├─ api/            # Fastify 服务，提供 GET /health
│  └─ web/            # React 占位页面「今天别硬撑」
├─ packages/
│  ├─ ai-core/        # AIProvider 空接口占位（不接入任何模型）
│  ├─ config/         # 共享 TypeScript 配置
│  ├─ contracts/      # Zod 契约（HealthResponseSchema 等）
│  ├─ database/       # Drizzle + PostgreSQL 结构预留（无业务表）
│  └─ domain/         # 领域层占位包
├─ docs/architecture/ # 架构说明（各包职责与依赖规则）
├─ compose.yaml       # 仅 PostgreSQL
└─ .env.example       # 环境变量示例
```

各包职责与禁止跨层依赖规则见 [docs/architecture/overview.md](docs/architecture/overview.md)。

## 快速开始

```bash
# 1. 安装依赖
pnpm install

# 2. 准备环境变量
cp .env.example .env

# 3. （可选）启动本地 PostgreSQL
docker compose up -d db

# 4. 开发模式（并行启动 web 与 api）
pnpm dev
```

- web：<http://localhost:5173>
- api：<http://localhost:3001/health>，返回 `{ "status": "ok", "service": "api" }`

## 根脚本

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 并行启动 apps 下的开发服务 |
| `pnpm build` | 按依赖顺序构建所有包与应用 |
| `pnpm typecheck` | 全仓库 TypeScript strict 类型检查 |
| `pnpm lint` | ESLint 检查 |
| `pnpm test` | Vitest 运行全部单元测试 |
