import { describe, expect, it } from 'vitest';
import { previewDailyPlan, type PreviewDailyPlanCommand } from './preview-daily-plan.js';

const HOUR = 3_600_000;
const T0 = 1_800_000_000_000;

/** 构造一份合法的预览命令（80 能量、单个 240 分钟窗口、无承诺、单个带 minimum 的任务）。 */
function makeCommand(overrides: Partial<PreviewDailyPlanCommand> = {}): PreviewDailyPlanCommand {
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

describe('previewDailyPlan 有效输入', () => {
  it('成功返回完整 DailySchedule', () => {
    const result = previewDailyPlan(makeCommand());
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.policyVersion).toBe('task-scheduling-policy-v1');
    expect(result.value.energyPolicyVersion).toBe('energy-policy-v1');
    expect(result.value.capacity.capacityState).toBe('available');
    expect(result.value.scheduledItems).toHaveLength(1);
    // 能量 80 且资源充足：must 升级为 full
    expect(result.value.scheduledItems[0]?.variant).toBe('full');
    expect(result.value.deferredItems).toEqual([]);
  });

  it('相同命令返回完全一致的结果（确定性贯穿用例层）', () => {
    expect(previewDailyPlan(makeCommand())).toEqual(previewDailyPlan(makeCommand()));
  });
});

describe('previewDailyPlan 领域错误', () => {
  it('聚合多个领域错误且不 throw', () => {
    const result = previewDailyPlan(
      makeCommand({
        // 非法能量档位（进入 domain 判定）
        checkIn: { id: 'checkin-1', energyLevel: 65, strainTags: [] },
        // 空窗口
        planningWindows: [],
        // 非法优先级
        tasks: [
          {
            id: 'task-1',
            title: '写周报',
            priority: 'urgent',
            estimatedMinutes: 60,
            energyDemand: 2,
            emotionalResistance: 0,
          },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    const codes = result.errors.map((error) => error.code);
    expect(codes).toContain('INVALID_ENERGY_LEVEL');
    expect(codes).toContain('EMPTY_PLANNING_WINDOWS');
    expect(codes).toContain('INVALID_PRIORITY');
    // 原始结构化错误：每条都有 path 与 message
    result.errors.forEach((error) => {
      expect(error.path.length).toBeGreaterThan(0);
      expect(error.message.length).toBeGreaterThan(0);
    });
  });

  it('单个领域错误原样透传（path 精确到字段）', () => {
    const result = previewDailyPlan(
      makeCommand({
        tasks: [
          {
            id: 'task-1',
            title: '写周报',
            priority: 'must',
            estimatedMinutes: 3,
            energyDemand: 2,
            emotionalResistance: 0,
          },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errors).toEqual([
      {
        code: 'INVALID_NUMBER',
        path: 'tasks[0].estimatedMinutes',
        message: 'estimatedMinutes必须为 5 至 480 的整数',
      },
    ]);
  });
});
