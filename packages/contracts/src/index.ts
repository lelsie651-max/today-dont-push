import { z } from 'zod';

/**
 * 健康检查响应契约。
 * `apps/api` 的 GET /health 必须返回该结构，前后端与测试以此为准。
 */
export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('api'),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
