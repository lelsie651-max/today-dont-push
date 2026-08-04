import { describe, expect, it } from 'vitest';
import type { DailyPlanningInputInput } from './planning.js';
import { createDailyPlanningInput } from './planning.js';

const HOUR = 3_600_000;
const T0 = 1_800_000_000_000;

/** 构造一份合法的每日规划输入（可按字段覆盖）。 */
function validInput(overrides: Partial<DailyPlanningInputInput> = {}): DailyPlanningInputInput {
  return {
    id: 'plan-2026-08-04',
    localDate: '2026-08-04',
    timeZone: 'Asia/Shanghai',
    checkIn: { id: 'checkin-1', energyLevel: 50, strainTags: ['meeting_heavy'] },
    planningWindows: [
      { startAtMs: T0, endAtMs: T0 + 3 * HOUR },
      { startAtMs: T0 + 5 * HOUR, endAtMs: T0 + 9 * HOUR },
    ],
    commitments: [
      {
        id: 'standup',
        title: '晨会',
        window: { startAtMs: T0 + HOUR, endAtMs: T0 + 2 * HOUR },
        energyDemand: 2,
      },
    ],
    tasks: [
      {
        id: 'task-1',
        title: '写周报',
        priority: 'important',
        estimatedMinutes: 60,
        energyDemand: 3,
        emotionalResistance: 1,
      },
    ],
    ...overrides,
  };
}

describe('createDailyPlanningInput', () => {
  it('构造合法的每日规划输入', () => {
    const result = createDailyPlanningInput(validInput());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.localDate).toBe('2026-08-04');
      expect(result.value.timeZone).toBe('Asia/Shanghai');
      expect(result.value.commitments).toHaveLength(1);
      expect(result.value.tasks).toHaveLength(1);
    }
  });

  it('允许 tasks 为空', () => {
    const result = createDailyPlanningInput(validInput({ tasks: [] }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.tasks).toEqual([]);
    }
  });

  it('返回的 planningWindows 按开始时间排序', () => {
    const result = createDailyPlanningInput(
      validInput({
        planningWindows: [
          { startAtMs: T0 + 5 * HOUR, endAtMs: T0 + 9 * HOUR },
          { startAtMs: T0, endAtMs: T0 + 3 * HOUR },
        ],
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.planningWindows[0]?.startAtMs).toBe(T0);
      expect(result.value.planningWindows[1]?.startAtMs).toBe(T0 + 5 * HOUR);
    }
  });

  it.each(['2026-13-01', '2026-02-30', '2026/08/04', '2026-8-04', ''])(
    '拒绝非法 localDate（%s）',
    (localDate) => {
      const result = createDailyPlanningInput(validInput({ localDate }));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.code === 'INVALID_LOCAL_DATE')).toBe(true);
      }
    },
  );

  it('闰年 2 月 29 日合法，平年不合法', () => {
    expect(createDailyPlanningInput(validInput({ localDate: '2028-02-29' })).ok).toBe(true);
    expect(createDailyPlanningInput(validInput({ localDate: '2026-02-29' })).ok).toBe(false);
  });

  it('拒绝空 timeZone', () => {
    const result = createDailyPlanningInput(validInput({ timeZone: '   ' }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'INVALID_TEXT' && e.path === 'timeZone')).toBe(
        true,
      );
    }
  });

  it('拒绝空 planningWindows', () => {
    const result = createDailyPlanningInput(validInput({ planningWindows: [], commitments: [] }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'EMPTY_PLANNING_WINDOWS')).toBe(true);
    }
  });

  it('拒绝重叠的 planningWindows', () => {
    const result = createDailyPlanningInput(
      validInput({
        planningWindows: [
          { startAtMs: T0, endAtMs: T0 + 3 * HOUR },
          { startAtMs: T0 + 2 * HOUR, endAtMs: T0 + 5 * HOUR },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'OVERLAPPING_PLANNING_WINDOWS')).toBe(true);
    }
  });

  it('接受边界相接（不重叠）的 planningWindows', () => {
    const result = createDailyPlanningInput(
      validInput({
        planningWindows: [
          { startAtMs: T0, endAtMs: T0 + 2 * HOUR },
          { startAtMs: T0 + 2 * HOUR, endAtMs: T0 + 4 * HOUR },
        ],
        commitments: [
          {
            id: 'standup',
            title: '晨会',
            window: { startAtMs: T0, endAtMs: T0 + HOUR },
            energyDemand: 2,
          },
        ],
      }),
    );
    expect(result.ok).toBe(true);
  });

  it('拒绝互相重叠的 commitments', () => {
    const result = createDailyPlanningInput(
      validInput({
        commitments: [
          {
            id: 'a',
            title: '会议A',
            window: { startAtMs: T0 + HOUR, endAtMs: T0 + 3 * HOUR },
            energyDemand: 2,
          },
          {
            id: 'b',
            title: '会议B',
            window: { startAtMs: T0 + 2 * HOUR, endAtMs: T0 + 4 * HOUR },
            energyDemand: 2,
          },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'OVERLAPPING_COMMITMENTS')).toBe(true);
    }
  });

  it('拒绝越出 planningWindows 的 commitment', () => {
    const result = createDailyPlanningInput(
      validInput({
        commitments: [
          {
            id: 'late',
            title: '横跨午休的会',
            // 从第一段 planningWindow 跨到第二段之间的空档之外
            window: { startAtMs: T0 + 2 * HOUR, endAtMs: T0 + 6 * HOUR },
            energyDemand: 2,
          },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'COMMITMENT_OUTSIDE_PLANNING_WINDOW')).toBe(true);
    }
  });

  it('拒绝 commitments 与 tasks 之间的重复 id', () => {
    const result = createDailyPlanningInput(
      validInput({
        commitments: [
          {
            id: 'dup',
            title: '晨会',
            window: { startAtMs: T0 + HOUR, endAtMs: T0 + 2 * HOUR },
            energyDemand: 2,
          },
        ],
        tasks: [
          {
            id: 'dup',
            title: '写周报',
            priority: 'must',
            estimatedMinutes: 30,
            energyDemand: 2,
            emotionalResistance: 0,
          },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some((e) => e.code === 'DUPLICATE_ID' && e.path === 'tasks[0].id'),
      ).toBe(true);
    }
  });

  it('拒绝同类型内部的重复 id', () => {
    const result = createDailyPlanningInput(
      validInput({
        tasks: [
          {
            id: 'task-1',
            title: '写周报',
            priority: 'important',
            estimatedMinutes: 60,
            energyDemand: 3,
            emotionalResistance: 1,
          },
          {
            id: 'task-1',
            title: '另一件事',
            priority: 'optional',
            estimatedMinutes: 30,
            energyDemand: 1,
            emotionalResistance: 0,
          },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some((e) => e.code === 'DUPLICATE_ID' && e.path === 'tasks[1].id'),
      ).toBe(true);
    }
  });

  it('checkIn 非法时透传其错误', () => {
    const result = createDailyPlanningInput(
      validInput({
        checkIn: { id: 'checkin-1', energyLevel: 55, strainTags: ['other'] },
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const codes = result.errors.map((e) => e.code);
      expect(codes).toContain('INVALID_ENERGY_LEVEL');
      expect(codes).toContain('NOTE_REQUIRED');
    }
  });

  it('接受跨午夜的有效时间戳范围作为 planningWindows', () => {
    const result = createDailyPlanningInput(
      validInput({
        planningWindows: [{ startAtMs: T0, endAtMs: T0 + 26 * HOUR }],
        commitments: [
          {
            id: 'night-shift',
            title: '夜班',
            window: { startAtMs: T0 + 20 * HOUR, endAtMs: T0 + 25 * HOUR },
            energyDemand: 4,
          },
        ],
      }),
    );
    expect(result.ok).toBe(true);
  });
});

describe('createDailyPlanningInput 错误路径回归（必须指向原始输入索引）', () => {
  it('第一个 planningWindow 非法、后两个重叠时，重叠错误指向原输入索引', () => {
    const result = createDailyPlanningInput(
      validInput({
        planningWindows: [
          // 索引 0：非法窗口（end 不晚于 start）
          { startAtMs: T0 + HOUR, endAtMs: T0 },
          // 索引 1、2：合法但互相重叠
          { startAtMs: T0, endAtMs: T0 + 3 * HOUR },
          { startAtMs: T0 + 2 * HOUR, endAtMs: T0 + 5 * HOUR },
        ],
        commitments: [],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const overlap = result.errors.find((e) => e.code === 'OVERLAPPING_PLANNING_WINDOWS');
      expect(overlap).toBeDefined();
      // 若使用过滤后的数组索引，这里会错误地指向 planningWindows[1]
      expect(overlap?.path).toBe('planningWindows[2]');
      expect(result.errors.some((e) => e.code === 'INVALID_TIME_WINDOW' && e.path === 'planningWindows[0]')).toBe(true);
    }
  });

  it('第一个 commitment 非法、第二个越界时，错误指向 commitments[1]', () => {
    const result = createDailyPlanningInput(
      validInput({
        commitments: [
          // 索引 0：非法（energyDemand 越界）
          {
            id: 'bad',
            title: '非法承诺',
            window: { startAtMs: T0 + HOUR, endAtMs: T0 + 2 * HOUR },
            energyDemand: 9,
          },
          // 索引 1：合法字段但越出全部 planningWindows
          {
            id: 'outside',
            title: '越界承诺',
            window: { startAtMs: T0 + 3 * HOUR, endAtMs: T0 + 5 * HOUR },
            energyDemand: 2,
          },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const outside = result.errors.find((e) => e.code === 'COMMITMENT_OUTSIDE_PLANNING_WINDOW');
      expect(outside).toBeDefined();
      // 若使用过滤后的数组索引，这里会错误地指向 commitments[0]
      expect(outside?.path).toBe('commitments[1]');
    }
  });

  it('非法固定承诺标题的路径精确为 commitments[1].title', () => {
    const result = createDailyPlanningInput(
      validInput({
        commitments: [
          {
            id: 'ok',
            title: '合法承诺',
            window: { startAtMs: T0 + HOUR, endAtMs: T0 + 2 * HOUR },
            energyDemand: 2,
          },
          {
            id: 'no-title',
            title: '   ',
            window: { startAtMs: T0 + 5 * HOUR, endAtMs: T0 + 6 * HOUR },
            energyDemand: 2,
          },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // 不得出现 commitments[1].commitment.title 之类的双重前缀
      expect(result.errors.some((e) => e.code === 'INVALID_TEXT' && e.path === 'commitments[1].title')).toBe(true);
      expect(result.errors.every((e) => !e.path.includes('commitment.title'))).toBe(true);
    }
  });

  it('第一个 task 非法、后两个合法 task 重复 ID 时，错误指向原始后一个 task 索引', () => {
    const result = createDailyPlanningInput(
      validInput({
        tasks: [
          // 索引 0：非法（estimatedMinutes 越界）
          {
            id: 'bad-task',
            title: '非法任务',
            priority: 'must',
            estimatedMinutes: 999,
            energyDemand: 2,
            emotionalResistance: 0,
          },
          // 索引 1、2：合法但 id 重复
          {
            id: 'dup',
            title: '第一件事',
            priority: 'important',
            estimatedMinutes: 30,
            energyDemand: 2,
            emotionalResistance: 0,
          },
          {
            id: 'dup',
            title: '第二件事',
            priority: 'optional',
            estimatedMinutes: 30,
            energyDemand: 2,
            emotionalResistance: 0,
          },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const duplicate = result.errors.find((e) => e.code === 'DUPLICATE_ID');
      expect(duplicate).toBeDefined();
      // 若使用过滤后的数组索引，这里会错误地指向 tasks[1].id
      expect(duplicate?.path).toBe('tasks[2].id');
    }
  });

  it('存在非法窗口被过滤后，成功结果的 planningWindows 仍按开始时间排序', () => {
    const result = createDailyPlanningInput(
      validInput({
        planningWindows: [
          { startAtMs: T0 + 5 * HOUR, endAtMs: T0 + 9 * HOUR },
          // 非法窗口：不影响其余窗口的排序结果
          { startAtMs: T0 + 4 * HOUR, endAtMs: T0 + 3 * HOUR },
          { startAtMs: T0, endAtMs: T0 + 2 * HOUR },
        ],
        commitments: [],
      }),
    );
    expect(result.ok).toBe(false);
    // 上一断言验证失败路径；下面构造全部合法但乱序的输入验证排序
    const sorted = createDailyPlanningInput(
      validInput({
        planningWindows: [
          { startAtMs: T0 + 5 * HOUR, endAtMs: T0 + 9 * HOUR },
          { startAtMs: T0, endAtMs: T0 + 2 * HOUR },
        ],
        commitments: [],
      }),
    );
    expect(sorted.ok).toBe(true);
    if (sorted.ok) {
      expect(sorted.value.planningWindows.map((w) => w.startAtMs)).toEqual([T0, T0 + 5 * HOUR]);
    }
  });
});
