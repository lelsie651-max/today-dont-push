import { describe, expect, it } from 'vitest';
import { PlanPreviewRequestSchema } from '@today-dont-push/contracts';
import { zodIssuesToInvalidRequestErrors } from './plan-preview-http.js';

const HOUR = 3_600_000;
const T0 = 1_800_000_000_000;

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
      },
    ],
    ...overrides,
  };
}

describe('zodIssuesToInvalidRequestErrors', () => {
  it('把顶层未知字段展开为精确 path', () => {
    const parsed = PlanPreviewRequestSchema.safeParse(validPayload({ surprise: true }));
    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }

    expect(zodIssuesToInvalidRequestErrors(parsed.error.issues)).toContainEqual({
      code: 'unrecognized_keys',
      path: 'surprise',
      message: expect.any(String),
    });
  });

  it('把嵌套未知字段展开为精确 path', () => {
    const parsed = PlanPreviewRequestSchema.safeParse(
      validPayload({
        tasks: [
          {
            id: 'task-1',
            title: '写周报',
            priority: 'must',
            estimatedMinutes: 60,
            energyDemand: 2,
            emotionalResistance: 0,
            surprise: true,
          },
        ],
      }),
    );
    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }

    expect(zodIssuesToInvalidRequestErrors(parsed.error.issues)).toContainEqual({
      code: 'unrecognized_keys',
      path: 'tasks[0].surprise',
      message: expect.any(String),
    });
  });

  it('为多个未知字段分别生成独立错误', () => {
    const parsed = PlanPreviewRequestSchema.safeParse(
      validPayload({ surprise: true, unexpected: true }),
    );
    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }

    const errors = zodIssuesToInvalidRequestErrors(parsed.error.issues);
    expect(errors).toContainEqual({
      code: 'unrecognized_keys',
      path: 'surprise',
      message: expect.any(String),
    });
    expect(errors).toContainEqual({
      code: 'unrecognized_keys',
      path: 'unexpected',
      message: expect.any(String),
    });
    expect(errors).toHaveLength(2);
  });
});
