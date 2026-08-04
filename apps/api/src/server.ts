import Fastify, { type FastifyInstance } from 'fastify';
import {
  PlanPreviewRequestSchema,
  type HealthResponse,
} from '@today-dont-push/contracts';
import { previewDailyPlan } from '@today-dont-push/application';

/** 请求体上限：256KB。 */
const BODY_LIMIT_BYTES = 256 * 1024;

/** 把 Zod 的 issue path 转换为 `tasks[0].title` 风格的契约路径。 */
function toContractPath(path: readonly PropertyKey[]): string {
  let result = '';
  for (const segment of path) {
    const text = String(segment);
    if (/^\d+$/.test(text)) {
      result += `[${text}]`;
    } else if (result === '') {
      result = text;
    } else {
      result += `.${text}`;
    }
  }
  return result;
}

/**
 * 构建 Fastify 应用实例（与监听分离，便于测试注入）。
 *
 * 分层职责：handler 只做"契约校验 → 用例编排 → 状态码映射"，
 * 不复制调度或领域校验逻辑（一切业务规则经由 application → domain）。
 */
export function buildServer(): FastifyInstance {
  const app = Fastify({ bodyLimit: BODY_LIMIT_BYTES });

  app.get('/health', async (): Promise<HealthResponse> => {
    return { status: 'ok', service: 'api' };
  });

  app.post('/v1/plans/preview', async (request, reply) => {
    // 1) contracts 负责 JSON 结构与安全上限；结构错误 → 400。
    const parsed = PlanPreviewRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        status: 'invalid_request',
        errors: parsed.error.issues.map((issue) => ({
          code: issue.code,
          path: toContractPath(issue.path),
          message: issue.message,
        })),
      });
    }

    // 2) application 用例负责领域校验与调度编排；领域错误 → 422。
    const result = previewDailyPlan(parsed.data);
    if (!result.ok) {
      return reply.status(422).send({
        status: 'invalid_input',
        errors: result.errors.map((domainError) => ({
          code: domainError.code,
          path: domainError.path,
          message: domainError.message,
        })),
      });
    }

    // 3) 成功 → 200 + 完整 DailySchedule。
    return reply.status(200).send({ status: 'ok', data: result.value });
  });

  return app;
}
