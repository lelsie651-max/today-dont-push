import { describe, expect, it } from 'vitest';
import {
  DailyScheduleSchema,
  PLAN_PREVIEW_MAX_COMMITMENTS,
  PLAN_PREVIEW_MAX_PLANNING_WINDOWS,
  PLAN_PREVIEW_MAX_STRAIN_TAGS,
  PLAN_PREVIEW_MAX_TASKS,
  PlanPreviewInvalidInputResponseSchema,
  PlanPreviewInvalidRequestResponseSchema,
  PlanPreviewRequestSchema,
  PlanPreviewResponseSchema,
  PlanPreviewSuccessResponseSchema,
} from './index.js';

const HOUR = 3_600_000;
const MINUTE = 60_000;
const T0 = 1_800_000_000_000;

/** 合法请求载荷工厂。 */
function validRequest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
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

describe('PlanPreviewRequestSchema 结构与安全上限', () => {
  it('解析合法请求', () => {
    expect(() => PlanPreviewRequestSchema.parse(validRequest())).not.toThrow();
  });

  it('energyLevel 接受任意整数（是否为 20/50/80 由 domain 判定）', () => {
    const request = validRequest({
      checkIn: { id: 'checkin-1', energyLevel: 65, strainTags: [] },
    });
    expect(() => PlanPreviewRequestSchema.parse(request)).not.toThrow();
  });

  it('拒绝顶层未知字段（strict）', () => {
    expect(() => PlanPreviewRequestSchema.parse(validRequest({ surprise: true }))).toThrow();
  });

  it('拒绝嵌套对象中的未知字段（strict）', () => {
    const request = validRequest({
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
    });
    expect(() => PlanPreviewRequestSchema.parse(request)).toThrow();
  });

  it('拒绝缺少必填字段', () => {
    const missing = { ...validRequest() };
    delete missing.localDate;
    expect(() => PlanPreviewRequestSchema.parse(missing)).toThrow();
  });

  it(`拒绝超过 ${PLAN_PREVIEW_MAX_TASKS} 个 tasks`, () => {
    const tasks = Array.from({ length: PLAN_PREVIEW_MAX_TASKS + 1 }, (_, index) => ({
      id: `task-${index}`,
      title: '任务',
      priority: 'optional',
      estimatedMinutes: 30,
      energyDemand: 1,
      emotionalResistance: 0,
    }));
    expect(() => PlanPreviewRequestSchema.parse(validRequest({ tasks }))).toThrow();
  });

  it(`拒绝超过 ${PLAN_PREVIEW_MAX_PLANNING_WINDOWS} 个 planningWindows`, () => {
    const planningWindows = Array.from(
      { length: PLAN_PREVIEW_MAX_PLANNING_WINDOWS + 1 },
      (_, index) => ({
        startAtMs: T0 + index * 2 * HOUR,
        endAtMs: T0 + index * 2 * HOUR + HOUR,
      }),
    );
    expect(() => PlanPreviewRequestSchema.parse(validRequest({ planningWindows }))).toThrow();
  });

  it(`拒绝超过 ${PLAN_PREVIEW_MAX_COMMITMENTS} 个 commitments`, () => {
    const commitments = Array.from({ length: PLAN_PREVIEW_MAX_COMMITMENTS + 1 }, (_, index) => ({
      id: `c-${index}`,
      title: '承诺',
      window: { startAtMs: T0 + index * MINUTE, endAtMs: T0 + (index + 1) * MINUTE },
      energyDemand: 1,
    }));
    expect(() => PlanPreviewRequestSchema.parse(validRequest({ commitments }))).toThrow();
  });

  it(`拒绝超过 ${PLAN_PREVIEW_MAX_STRAIN_TAGS} 个 strainTags`, () => {
    const request = validRequest({
      checkIn: {
        id: 'checkin-1',
        energyLevel: 20,
        strainTags: Array.from({ length: PLAN_PREVIEW_MAX_STRAIN_TAGS + 1 }, (_, i) => `tag-${i}`),
      },
    });
    expect(() => PlanPreviewRequestSchema.parse(request)).toThrow();
  });

  it('拒绝非整数时间戳', () => {
    const request = validRequest({
      planningWindows: [{ startAtMs: T0 + 0.5, endAtMs: T0 + 4 * HOUR }],
    });
    expect(() => PlanPreviewRequestSchema.parse(request)).toThrow();
  });

  it('拒绝非安全整数的 planningWindows[0].startAtMs', () => {
    const parsed = PlanPreviewRequestSchema.safeParse(
      validRequest({
        planningWindows: [
          { startAtMs: Number.MAX_SAFE_INTEGER + 1, endAtMs: T0 + 4 * HOUR },
        ],
      }),
    );
    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }

    expect(parsed.error.issues.some((issue) => issue.path.join('.') === 'planningWindows.0.startAtMs')).toBe(
      true,
    );
  });

  it('拒绝非安全整数的 tasks[0].deadlineAtMs', () => {
    const parsed = PlanPreviewRequestSchema.safeParse(
      validRequest({
        tasks: [
          {
            id: 'task-1',
            title: '写周报',
            priority: 'must',
            estimatedMinutes: 60,
            energyDemand: 2,
            emotionalResistance: 0,
            deadlineAtMs: Number.MAX_SAFE_INTEGER + 1,
          },
        ],
      }),
    );
    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }

    expect(parsed.error.issues.some((issue) => issue.path.join('.') === 'tasks.0.deadlineAtMs')).toBe(
      true,
    );
  });
});

// 完整调度输出夹具（手写：contracts 不得依赖 domain）。
const scheduleFixture = {
  policyVersion: 'task-scheduling-policy-v1',
  energyPolicyVersion: 'energy-policy-v1',
  capacity: {
    policyVersion: 'energy-policy-v1',
    totalPlanningMinutes: 240,
    fixedCommitmentMinutes: 0,
    freeMinutes: 240,
    protectedBufferMinutes: 25,
    schedulableMinutes: 215,
    baseEnergyPoints: 80,
    strainPenaltyPoints: 0,
    adjustedEnergyPoints: 80,
    commitmentEnergyCostPoints: 0,
    remainingEnergyPoints: 80,
    freeSlots: [{ startAtMs: T0, endAtMs: T0 + 4 * HOUR }],
    capacityState: 'available',
    reasons: [
      { code: 'NO_FIXED_COMMITMENTS', message: '今天没有固定承诺', values: {} },
      {
        code: 'PROTECTED_BUFFER_RESERVED',
        message: '为恢复预留了 25 分钟保护性空白',
        values: { protectedBufferMinutes: 25, protectedBufferPercent: 10, freeMinutes: 240 },
      },
    ],
  },
  scheduledItems: [
    {
      taskId: 'task-1',
      title: '写周报',
      priority: 'must',
      variant: 'full',
      window: { startAtMs: T0, endAtMs: T0 + HOUR },
      minutes: 60,
      energyCostPoints: 4,
      reasonCodes: ['FULL_VERSION_SELECTED'],
      decisionRank: 0,
    },
  ],
  deferredItems: [
    {
      taskId: 'task-2',
      priority: 'optional',
      attemptedVariants: ['full'],
      reasons: [
        {
          code: 'INSUFFICIENT_TOTAL_MINUTES',
          message: '剩余可安排时间不足',
          values: { requiredMinutes: 300, remainingSchedulableMinutes: 155 },
        },
      ],
      reasonCodes: ['INSUFFICIENT_TOTAL_MINUTES'],
    },
  ],
  remainingSchedulableMinutes: 155,
  remainingEnergyPoints: 76,
  mustTaskDeferredIds: [],
};

describe('PlanPreview 响应契约', () => {
  it('DailyScheduleSchema 完整描述调度输出（逐字段 strict）', () => {
    expect(DailyScheduleSchema.parse(scheduleFixture)).toEqual(scheduleFixture);
    expect(() =>
      DailyScheduleSchema.parse({ ...scheduleFixture, surprise: true }),
    ).toThrow();
  });

  it('200 成功响应契约', () => {
    const response = { status: 'ok', data: scheduleFixture };
    expect(PlanPreviewSuccessResponseSchema.parse(response)).toEqual(response);
    expect(PlanPreviewResponseSchema.parse(response)).toEqual(response);
  });

  it('400 invalid_request 响应契约', () => {
    const response = {
      status: 'invalid_request',
      errors: [{ code: 'invalid_type', path: 'localDate', message: '必填' }],
    };
    expect(PlanPreviewInvalidRequestResponseSchema.parse(response)).toEqual(response);
    expect(PlanPreviewResponseSchema.parse(response)).toEqual(response);
    // errors 不得为空
    expect(() =>
      PlanPreviewInvalidRequestResponseSchema.parse({ status: 'invalid_request', errors: [] }),
    ).toThrow();
  });

  it('422 invalid_input 响应契约', () => {
    const response = {
      status: 'invalid_input',
      errors: [
        {
          code: 'INVALID_ENERGY_LEVEL',
          path: 'checkIn.energyLevel',
          message: 'energyLevel 必须为 20 / 50 / 80 之一',
        },
      ],
    };
    expect(PlanPreviewInvalidInputResponseSchema.parse(response)).toEqual(response);
    expect(PlanPreviewResponseSchema.parse(response)).toEqual(response);
  });

  it('拒绝未知 status', () => {
    expect(() => PlanPreviewResponseSchema.parse({ status: 'boom' })).toThrow();
  });
});
