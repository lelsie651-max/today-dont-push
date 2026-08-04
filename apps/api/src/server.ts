import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import {
  PlanPreviewRequestSchema,
  type HealthResponse,
} from '@today-dont-push/contracts';
import { previewDailyPlan } from '@today-dont-push/application';
import {
  sendPlanPreviewInvalidInput,
  sendPlanPreviewInvalidRequest,
  sendPlanPreviewSuccess,
  zodIssuesToInvalidRequestErrors,
} from './plan-preview-http.js';

/** 请求体上限：256KB。 */
const BODY_LIMIT_BYTES = 256 * 1024;

/**
 * 构建 Fastify 应用实例（与监听分离，便于测试注入）。
 *
 * 分层职责：handler 只做"契约校验 → 用例编排 → 状态码映射"，
 * 不复制调度或领域校验逻辑（一切业务规则经由 application → domain）。
 */
export function buildServer(): FastifyInstance {
  const app = Fastify({ bodyLimit: BODY_LIMIT_BYTES });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (
      request.method === 'POST' &&
      request.url.split('?')[0] === '/v1/plans/preview' &&
      error.code === 'FST_ERR_CTP_INVALID_JSON_BODY'
    ) {
      return sendPlanPreviewInvalidRequest(reply, [
        {
          code: 'invalid_json',
          path: 'body',
          message: error.message,
        },
      ]);
    }

    return reply.send(error);
  });

  app.get('/health', async (): Promise<HealthResponse> => {
    return { status: 'ok', service: 'api' };
  });

  app.post('/v1/plans/preview', async (request, reply) => {
    // 1) contracts 负责 JSON 结构与安全上限；结构错误 → 400。
    const parsed = PlanPreviewRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendPlanPreviewInvalidRequest(reply, zodIssuesToInvalidRequestErrors(parsed.error.issues));
    }

    // 2) application 用例负责领域校验与调度编排；领域错误 → 422。
    const result = previewDailyPlan(parsed.data);
    if (!result.ok) {
      return sendPlanPreviewInvalidInput(
        reply,
        result.errors.map((domainError) => ({
          code: domainError.code,
          path: domainError.path,
          message: domainError.message,
        })),
      );
    }

    // 3) 成功 → 200 + 完整 DailySchedule。
    return sendPlanPreviewSuccess(reply, result.value);
  });

  return app;
}
