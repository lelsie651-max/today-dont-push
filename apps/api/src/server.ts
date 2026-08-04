import Fastify, { type FastifyInstance } from 'fastify';
import type { HealthResponse } from '@today-dont-push/contracts';

/**
 * 构建 Fastify 应用实例（与监听分离，便于测试注入）。
 */
export function buildServer(): FastifyInstance {
  const app = Fastify();

  app.get('/health', async (): Promise<HealthResponse> => {
    return { status: 'ok', service: 'api' };
  });

  return app;
}
