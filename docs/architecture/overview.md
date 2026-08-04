# 架构总览

本文档记录《今天别硬撑》Monorepo 中各包的职责，以及必须遵守的跨层依赖规则。
这些规则由 dependency-cruiser 自动强制执行（`pnpm architecture:check`）。

## 独立性声明

本项目完全独立，不依赖或复用“织文”项目的任何代码。

## 各包职责

| 包 | 层级 | 职责 | 本轮状态 |
| --- | --- | --- | --- |
| `apps/web` | 应用 | React 前端，负责页面与交互 | 仅占位页「今天别硬撑」 |
| `apps/api` | 应用 | Fastify 后端，组合根：装配应用层与基础设施，对外提供 HTTP 接口 | 仅 `GET /health` 与环境变量校验 |
| `packages/application` | 应用层 | 用例编排，协调 domain 完成业务 | 空占位，仅说明与占位测试 |
| `packages/domain` | 领域层 | 领域模型与业务规则的唯一归属地 | 空占位，仅说明与占位测试 |
| `packages/contracts` | 契约 | 用 Zod 定义跨端共享的数据契约与类型 | `HealthResponseSchema` |
| `packages/database` | 基础设施适配器 | Drizzle + PostgreSQL 数据访问 | 结构预留，无任何业务表 |
| `packages/ai-core` | 基础设施适配器 | AI 能力的统一抽象（AIProvider 接口） | 仅空接口，不接入任何模型 |
| `packages/config` | 工具 | 共享 TypeScript 配置（不参与运行时依赖图） | `tsconfig.base.json` / `tsconfig.react.json` |

## 依赖规则（禁止跨层依赖）

依赖方向只允许 **自上而下**，禁止反向、跨层与循环引用：

```
apps/web ──▶ contracts
apps/api ──▶ contracts / application / database / ai-core
application ──▶ domain
database / ai-core ──▶ （未来）application / domain
```

1. `packages/*` **永远不得依赖 `apps/*`**；禁止一切循环依赖。
2. `contracts`：**不得依赖任何内部包**（只允许 zod 等第三方库）。
3. `domain`：**不得依赖任何内部包，也不得依赖任何框架或第三方库**。
4. `application`：**只允许依赖 `domain`**。
5. `database`、`ai-core`：属于基础设施适配器，**未来可依赖 `application`/`domain`**（本轮无内部依赖），**两者之间禁止互相依赖**（由规则 `infra-no-database-to-ai-core` 与 `infra-no-ai-core-to-database` 分别强制）。
6. `apps/web`：**只允许依赖 `contracts`**，禁止依赖 `database`、`domain`、`ai-core`、`application`（数据只能经由 API）。
7. `apps/api`：负责组合 `contracts`、`application`、`database`、`ai-core`；**不得直接依赖 `domain`**（领域逻辑一律经由 `application`）。
8. 新增包时必须在本文件登记职责与允许的依赖方向，并在 dependency-cruiser 配置中落地对应规则。
9. 规则回归：`tests/architecture/fixtures/` 提供违规模拟文件，由 `tests/architecture/rules.regression.test.ts` 自动断言违规被拒绝、合法依赖通过，随 `pnpm test`/`pnpm check` 运行。

## AI 能力（占位说明）

- 本轮**不接入任何真实模型**，`packages/ai-core` 只定义 `AIProvider` 接口。
- 未来默认供应商计划为 **DeepSeek**。
- 具体模型名称在接入时再确定，**不在代码或配置中硬编码未来模型名称**。
- 本轮环境变量不读取、不要求任何 AI Key。
