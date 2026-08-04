# 架构总览

本文档记录《今天别硬撑》Monorepo 中各包的职责，以及必须遵守的跨层依赖规则。

## 独立性声明

本项目完全独立，不依赖或复用“织文”项目的任何代码。

## 各包职责

| 包 | 类型 | 职责 | 本轮状态 |
| --- | --- | --- | --- |
| `apps/web` | 应用 | React 前端，负责页面与交互 | 仅占位页「今天别硬撑」 |
| `apps/api` | 应用 | Fastify 后端，对外提供 HTTP 接口 | 仅 `GET /health` |
| `packages/contracts` | 契约 | 用 Zod 定义跨端共享的数据契约与类型 | `HealthResponseSchema` |
| `packages/domain` | 领域 | 领域模型与业务规则的唯一归属地 | 空占位，仅说明与占位测试 |
| `packages/database` | 基础设施 | Drizzle + PostgreSQL 数据访问结构 | 结构预留，无任何业务表 |
| `packages/ai-core` | 基础设施 | AI 能力的统一抽象（AIProvider 接口） | 仅空接口，不接入任何模型 |
| `packages/config` | 工具 | 共享 TypeScript 配置 | `tsconfig.base.json` / `tsconfig.react.json` |

## 依赖规则（禁止跨层依赖）

依赖方向只允许 **自上而下**，禁止反向或跨层引用：

```
apps/web ──▶ packages/contracts
apps/api ──▶ packages/contracts / domain / database / ai-core
packages/* ──▶ 仅第三方依赖（如 zod、drizzle-orm）
```

1. `apps/*` 可以依赖 `packages/*`；**`packages/*` 永远不得依赖 `apps/*`**。
2. `packages/contracts` 只依赖第三方库（zod），**不得依赖任何内部包**。
3. `packages/domain` 是业务规则的唯一归属地，**不得依赖 `database`、`ai-core`、Web 框架或任何基础设施包**；基础设施依赖领域，而不是相反。
4. `packages/database` 只提供数据访问结构，**不得包含业务逻辑，不得依赖 `domain`、`ai-core`**。
5. `packages/ai-core` 只定义 AI 抽象，**不得依赖业务包（`domain`）或其他基础设施包**。
6. `apps/web` 通过 `packages/contracts` 获取共享类型，**不得直接依赖 `packages/database`**（数据只能经由 API）。
7. 新增包时必须在本文件登记职责，并说明其允许的依赖方向。
