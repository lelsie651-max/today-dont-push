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
    availability: [
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

  it('返回的 availability 按开始时间排序', () => {
    const result = createDailyPlanningInput(
      validInput({
        availability: [
          { startAtMs: T0 + 5 * HOUR, endAtMs: T0 + 9 * HOUR },
          { startAtMs: T0, endAtMs: T0 + 3 * HOUR },
        ],
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.availability[0]?.startAtMs).toBe(T0);
      expect(result.value.availability[1]?.startAtMs).toBe(T0 + 5 * HOUR);
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

  it('拒绝空 availability', () => {
    const result = createDailyPlanningInput(validInput({ availability: [], commitments: [] }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'EMPTY_AVAILABILITY')).toBe(true);
    }
  });

  it('拒绝重叠的 availability', () => {
    const result = createDailyPlanningInput(
      validInput({
        availability: [
          { startAtMs: T0, endAtMs: T0 + 3 * HOUR },
          { startAtMs: T0 + 2 * HOUR, endAtMs: T0 + 5 * HOUR },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'OVERLAPPING_AVAILABILITY')).toBe(true);
    }
  });

  it('接受边界相接（不重叠）的 availability', () => {
    const result = createDailyPlanningInput(
      validInput({
        availability: [
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

  it('拒绝越出 availability 的 commitment', () => {
    const result = createDailyPlanningInput(
      validInput({
        commitments: [
          {
            id: 'late',
            title: '横跨午休的会',
            // 从第一段 availability 跨到第二段之间的空档之外
            window: { startAtMs: T0 + 2 * HOUR, endAtMs: T0 + 6 * HOUR },
            energyDemand: 2,
          },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'COMMITMENT_OUTSIDE_AVAILABILITY')).toBe(true);
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

  it('接受跨午夜的有效时间戳范围作为 availability', () => {
    const result = createDailyPlanningInput(
      validInput({
        availability: [{ startAtMs: T0, endAtMs: T0 + 26 * HOUR }],
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
