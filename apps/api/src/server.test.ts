import { afterAll, describe, expect, it } from 'vitest';
import { HealthResponseSchema } from '@today-dont-push/contracts';
import { buildServer } from './server.js';

describe('GET /health', () => {
  const app = buildServer();

  afterAll(async () => {
    await app.close();
  });

  it('返回 200 与固定健康检查结构', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok', service: 'api' });
  });

  it('响应符合 contracts 的 HealthResponseSchema', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    const body: unknown = response.json();
    expect(() => HealthResponseSchema.parse(body)).not.toThrow();
  });
});
