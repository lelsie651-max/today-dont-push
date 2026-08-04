import { afterAll, describe, expect, it } from 'vitest';
import {
  PLAN_PREVIEW_MAX_TASKS,
  PlanPreviewInvalidInputResponseSchema,
  PlanPreviewInvalidRequestResponseSchema,
  PlanPreviewResponseSchema,
  PlanPreviewSuccessResponseSchema,
} from '@today-dont-push/contracts';
import { buildServer } from './server.js';

const HOUR = 3_600_000;
const T0 = 1_800_000_000_000;

/** 合法请求载荷工厂（80 能量、单个 240 分钟窗口、无承诺、单个带 minimum 的 must 任务）。 */
function validPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'plan-1',
    localDate: '2026-08-04',
    timeZone: 'Asia/Shanghai',
    checkIn: { id: 'checkin-1', energyLevel: 80, strainTags: [] },
    planningWindows: [{ startAtMs: T0, endAtMs: T0 + 4 * HOUR }],
    commitments: [],
    tasks: [
      {
        id: 'task-1',
        title: '写周报',
        priority: 'must',
        estimatedMinutes: 60,
        energyDemand: 2,
        emotionalResistance: 0,
        minimumVersion: { title: '写个开头', estimatedMinutes: 15, energyDemand: 1 },
      },
    ],
    ...overrides,
  };
}

describe('POST /v1/plans/preview', () => {
  const app = buildServer();

  afterAll(async () => {
    await app.close();
  });

  it('有效请求返回 200 且响应通过成功契约', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/plans/preview',
      payload: validPayload(),
    });
    expect(response.statusCode).toBe(200);
    const body: unknown = response.json();
    const parsed = PlanPreviewSuccessResponseSchema.parse(body);
    expect(parsed.status).toBe('ok');
    expect(parsed.data.scheduledItems).toHaveLength(1);
    expect(parsed.data.scheduledItems[0]?.variant).toBe('full');
    expect(PlanPreviewResponseSchema.parse(body)).toEqual(parsed);
  });

  it('缺少必填字段返回 400，path 指向缺失字段', async () => {
    const payload = { ...validPayload() };
    delete payload.localDate;
    const response = await app.inject({
      method: 'POST',
      url: '/v1/plans/preview',
      payload,
    });
    expect(response.statusCode).toBe(400);
    const body: unknown = response.json();
    const parsed = PlanPreviewInvalidRequestResponseSchema.parse(body);
    expect(parsed.status).toBe('invalid_request');
    expect(parsed.errors.some((error) => error.path === 'localDate')).toBe(true);
  });

  it('未知字段返回 400（strict）', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/plans/preview',
      payload: validPayload({ surprise: true }),
    });
    expect(response.statusCode).toBe(400);
    const body: unknown = response.json();
    const parsed = PlanPreviewInvalidRequestResponseSchema.parse(body);
    expect(JSON.stringify(parsed.errors)).toContain('surprise');
  });

  it('energyLevel=65 进入 domain 判定并返回 422', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/plans/preview',
      payload: validPayload({
        checkIn: { id: 'checkin-1', energyLevel: 65, strainTags: [] },
      }),
    });
    expect(response.statusCode).toBe(422);
    const body: unknown = response.json();
    const parsed = PlanPreviewInvalidInputResponseSchema.parse(body);
    expect(parsed.status).toBe('invalid_input');
    expect(parsed.errors).toContainEqual({
      code: 'INVALID_ENERGY_LEVEL',
      path: 'checkIn.energyLevel',
      message: 'energyLevel 必须为 20 / 50 / 80 之一',
    });
  });

  it('planningWindows 重叠返回 422 且 path 精确到原始索引', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/plans/preview',
      payload: validPayload({
        planningWindows: [
          { startAtMs: T0, endAtMs: T0 + 2 * HOUR },
          { startAtMs: T0 + HOUR, endAtMs: T0 + 3 * HOUR },
        ],
      }),
    });
    expect(response.statusCode).toBe(422);
    const body: unknown = response.json();
    const parsed = PlanPreviewInvalidInputResponseSchema.parse(body);
    expect(parsed.errors.some((error) => error.code === 'OVERLAPPING_PLANNING_WINDOWS')).toBe(true);
    expect(
      parsed.errors.some((error) => error.path === 'planningWindows[1]'),
    ).toBe(true);
  });

  it(`超过 tasks 数量上限（${PLAN_PREVIEW_MAX_TASKS}）返回 400`, async () => {
    const tasks = Array.from({ length: PLAN_PREVIEW_MAX_TASKS + 1 }, (_, index) => ({
      id: `task-${index}`,
      title: '任务',
      priority: 'optional',
      estimatedMinutes: 30,
      energyDemand: 1,
      emotionalResistance: 0,
    }));
    const response = await app.inject({
      method: 'POST',
      url: '/v1/plans/preview',
      payload: validPayload({ tasks }),
    });
    expect(response.statusCode).toBe(400);
    const body: unknown = response.json();
    const parsed = PlanPreviewInvalidRequestResponseSchema.parse(body);
    expect(parsed.errors.some((error) => error.path === 'tasks')).toBe(true);
  });

  it('相同请求的响应完全一致（端到端确定性）', async () => {
    const first = await app.inject({
      method: 'POST',
      url: '/v1/plans/preview',
      payload: validPayload(),
    });
    const second = await app.inject({
      method: 'POST',
      url: '/v1/plans/preview',
      payload: validPayload(),
    });
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(first.json()).toEqual(second.json());
  });
});
