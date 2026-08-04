import { describe, expect, it } from 'vitest';
import type { StrainTag } from '../check-in.js';
import type { DailyPlanningInput } from '../planning.js';
import { analyzeDailyCapacity } from './analyzer.js';
import { ENERGY_POLICY_V1 } from './energy-policy.js';

const HOUR = 3_600_000;
const MINUTE = 60_000;
const T0 = 1_800_000_000_000;

/** 构造一份合法的每日规划输入（默认：80 能量、无负担、单个 240 分钟窗口、无承诺）。 */
function makeInput(overrides: Partial<DailyPlanningInput> = {}): DailyPlanningInput {
  return {
    id: 'plan-1',
    localDate: '2026-08-04',
    timeZone: 'Asia/Shanghai',
    checkIn: { id: 'checkin-1', energyLevel: 80, strainTags: [] },
    planningWindows: [{ startAtMs: T0, endAtMs: T0 + 4 * HOUR }],
    commitments: [],
    tasks: [],
    ...overrides,
  };
}

describe('analyzeDailyCapacity 时间与能量账本', () => {
  it('available：无承诺时全部可规划时间都是空闲槽位', () => {
    const result = analyzeDailyCapacity(makeInput());
    expect(result.policyVersion).toBe('energy-policy-v1');
    expect(result.totalPlanningMinutes).toBe(240);
    expect(result.fixedCommitmentMinutes).toBe(0);
    expect(result.freeMinutes).toBe(240);
    // 80 能量保护 10%：240 × 10% = 24 → 向上取整到 5 分钟 = 25
    expect(result.protectedBufferMinutes).toBe(25);
    expect(result.schedulableMinutes).toBe(215);
    expect(result.baseEnergyPoints).toBe(80);
    expect(result.strainPenaltyPoints).toBe(0);
    expect(result.adjustedEnergyPoints).toBe(80);
    expect(result.commitmentEnergyCostPoints).toBe(0);
    expect(result.remainingEnergyPoints).toBe(80);
    expect(result.freeSlots).toEqual([{ startAtMs: T0, endAtMs: T0 + 4 * HOUR }]);
    expect(result.capacityState).toBe('available');
    expect(result.reasons.some((r) => r.code === 'NO_FIXED_COMMITMENTS')).toBe(true);
    expect(result.reasons.some((r) => r.code === 'CAPACITY_AVAILABLE')).toBe(true);
  });

  it('available：单个承诺切出两段空闲槽位，各数值逐项可复算', () => {
    const result = analyzeDailyCapacity(
      makeInput({
        commitments: [
          {
            id: 'standup',
            title: '晨会',
            window: { startAtMs: T0 + HOUR, endAtMs: T0 + 2 * HOUR },
            energyDemand: 2,
          },
        ],
      }),
    );
    expect(result.totalPlanningMinutes).toBe(240);
    expect(result.fixedCommitmentMinutes).toBe(60);
    expect(result.freeSlots).toEqual([
      { startAtMs: T0, endAtMs: T0 + HOUR },
      { startAtMs: T0 + 2 * HOUR, endAtMs: T0 + 4 * HOUR },
    ]);
    expect(result.freeMinutes).toBe(180);
    // 180 × 10% = 18 → 20
    expect(result.protectedBufferMinutes).toBe(20);
    expect(result.schedulableMinutes).toBe(160);
    // ceil(60/30) × 2 = 4
    expect(result.commitmentEnergyCostPoints).toBe(4);
    expect(result.remainingEnergyPoints).toBe(76);
    expect(result.capacityState).toBe('available');
  });

  it.each([[20, 30], [50, 20], [80, 10]] as const)(
    '三档能量的保护比例：%i 能量保护 %i%%（100 分钟空闲）',
    (energyLevel, expectedBuffer) => {
      const result = analyzeDailyCapacity(
        makeInput({
          checkIn: { id: 'checkin-1', energyLevel, strainTags: [] },
          planningWindows: [{ startAtMs: T0, endAtMs: T0 + 100 * MINUTE }],
        }),
      );
      expect(result.freeMinutes).toBe(100);
      expect(result.protectedBufferMinutes).toBe(expectedBuffer);
      expect(result.schedulableMinutes).toBe(100 - expectedBuffer);
    },
  );

  it('保护空白向上取整到 5 分钟：101 分钟 × 20% = 20.2 → 25', () => {
    const result = analyzeDailyCapacity(
      makeInput({
        checkIn: { id: 'checkin-1', energyLevel: 50, strainTags: [] },
        planningWindows: [{ startAtMs: T0, endAtMs: T0 + 101 * MINUTE }],
      }),
    );
    expect(result.protectedBufferMinutes).toBe(25);
  });

  it('保护空白不得超过空闲时间：1 分钟空闲 × 30% 取整后仍封顶为 1', () => {
    const result = analyzeDailyCapacity(
      makeInput({
        checkIn: { id: 'checkin-1', energyLevel: 20, strainTags: [] },
        planningWindows: [{ startAtMs: T0, endAtMs: T0 + MINUTE }],
      }),
    );
    expect(result.protectedBufferMinutes).toBe(1);
    expect(result.schedulableMinutes).toBe(0);
  });
});

describe('analyzeDailyCapacity strain 扣减', () => {
  it('按标签逐项扣减', () => {
    const result = analyzeDailyCapacity(
      makeInput({
        checkIn: {
          id: 'checkin-1',
          energyLevel: 80,
          strainTags: ['poor_sleep', 'meeting_heavy'],
        },
      }),
    );
    // 6 + 4 = 10
    expect(result.strainPenaltyPoints).toBe(10);
    expect(result.adjustedEnergyPoints).toBe(70);
    const applied = result.reasons.find((r) => r.code === 'STRAIN_PENALTY_APPLIED');
    expect(applied).toBeDefined();
    expect(applied?.values.rawStrainPenaltyPoints).toBe(10);
    expect(applied?.values.strainPenaltyPoints).toBe(10);
  });

  it('全部 8 个标签（原始 38 点）被 15 点上限截断', () => {
    const allTags: readonly StrainTag[] = [
      'poor_sleep',
      'physical_discomfort',
      'low_mood',
      'exhausting_commute',
      'meeting_heavy',
      'urgent_deadline',
      'interpersonal_stress',
      'other',
    ];
    const result = analyzeDailyCapacity(
      makeInput({
        checkIn: {
          id: 'checkin-1',
          energyLevel: 20,
          strainTags: allTags,
          note: '各种事情堆在一起',
        },
      }),
    );
    expect(result.strainPenaltyPoints).toBe(ENERGY_POLICY_V1.maxStrainPenaltyPoints);
    expect(result.adjustedEnergyPoints).toBe(5);
    const applied = result.reasons.find((r) => r.code === 'STRAIN_PENALTY_APPLIED');
    expect(applied?.values.rawStrainPenaltyPoints).toBe(38);
  });

  it('调整后能量不低于 0', () => {
    const result = analyzeDailyCapacity(
      makeInput({
        checkIn: {
          id: 'checkin-1',
          energyLevel: 20,
          strainTags: ['physical_discomfort', 'poor_sleep', 'low_mood'],
        },
        commitments: [
          {
            id: 'c1',
            title: '承诺',
            window: { startAtMs: T0 + HOUR, endAtMs: T0 + 2 * HOUR },
            energyDemand: 5,
          },
        ],
      }),
    );
    // adjusted = max(0, 20 - 15) = 5；cost = ceil(60/30) × 5 = 10 → remaining = max(0, 5 - 10) = 0
    expect(result.adjustedEnergyPoints).toBe(5);
    expect(result.remainingEnergyPoints).toBe(0);
    expect(result.capacityState).toBe('exhausted_by_commitments');
  });
});

describe('analyzeDailyCapacity capacityState', () => {
  it('exhausted_by_commitments：承诺能量成本达到调整后能量', () => {
    const result = analyzeDailyCapacity(
      makeInput({
        checkIn: { id: 'checkin-1', energyLevel: 50, strainTags: [] },
        commitments: [
          {
            id: 'marathon',
            title: '全天拉通会',
            window: { startAtMs: T0 + HOUR, endAtMs: T0 + 2 * HOUR },
            energyDemand: 5,
          },
        ],
      }),
    );
    // adjusted 50；cost = ceil(60/30) × 5 = 10 —— 这里构造 cost >= adjusted 的场景需要更重承诺
    expect(result.capacityState).toBe('available');

    const heavy = analyzeDailyCapacity(
      makeInput({
        checkIn: {
          id: 'checkin-1',
          energyLevel: 20,
          strainTags: ['poor_sleep', 'physical_discomfort', 'low_mood'],
        },
        commitments: [
          {
            id: 'night-shift',
            title: '夜班',
            window: { startAtMs: T0 + HOUR, endAtMs: T0 + 2 * HOUR },
            energyDemand: 5,
          },
        ],
      }),
    );
    // adjusted = 20 - 15 = 5；cost = 10 ≥ 5
    expect(heavy.capacityState).toBe('exhausted_by_commitments');
    expect(heavy.reasons.some((r) => r.code === 'EXHAUSTED_BY_COMMITMENT_ENERGY')).toBe(true);
  });

  it('exhausted_by_commitments：承诺占满全部可规划时间，可安排时间为 0', () => {
    const result = analyzeDailyCapacity(
      makeInput({
        planningWindows: [{ startAtMs: T0, endAtMs: T0 + 2 * HOUR }],
        commitments: [
          {
            id: 'full-day',
            title: '占满全天',
            window: { startAtMs: T0, endAtMs: T0 + 2 * HOUR },
            energyDemand: 1,
          },
        ],
      }),
    );
    expect(result.freeMinutes).toBe(0);
    expect(result.freeSlots).toEqual([]);
    expect(result.schedulableMinutes).toBe(0);
    expect(result.capacityState).toBe('exhausted_by_commitments');
    expect(result.reasons.some((r) => r.code === 'EXHAUSTED_NO_SCHEDULABLE_TIME')).toBe(true);
  });

  it('commitment_heavy：承诺占调整后能量至少 50%', () => {
    const result = analyzeDailyCapacity(
      makeInput({
        checkIn: { id: 'checkin-1', energyLevel: 50, strainTags: [] },
        commitments: [
          {
            id: 'long-meeting',
            title: '两小时半长会',
            // 150 分钟 × demand 5 → ceil(150/30) × 5 = 25，恰好为调整后能量 50 的一半
            window: { startAtMs: T0, endAtMs: T0 + 150 * MINUTE },
            energyDemand: 5,
          },
        ],
      }),
    );
    expect(result.adjustedEnergyPoints).toBe(50);
    expect(result.commitmentEnergyCostPoints).toBe(25);
    expect(result.capacityState).toBe('commitment_heavy');
    expect(result.reasons.some((r) => r.code === 'COMMITMENT_ENERGY_SHARE_HIGH')).toBe(true);
  });

  it('commitment_heavy：固定时间占可规划时间至少 50%（能量占比不高时）', () => {
    const result = analyzeDailyCapacity(
      makeInput({
        commitments: [
          {
            id: 'half-day',
            title: '半日通勤',
            // 120 / 240 分钟恰占一半；cost = ceil(120/30) × 1 = 4，能量占比不高
            window: { startAtMs: T0, endAtMs: T0 + 2 * HOUR },
            energyDemand: 1,
          },
        ],
      }),
    );
    expect(result.commitmentEnergyCostPoints).toBe(4);
    expect(result.capacityState).toBe('commitment_heavy');
    expect(result.reasons.some((r) => r.code === 'COMMITMENT_TIME_SHARE_HIGH')).toBe(true);
    expect(result.reasons.some((r) => r.code === 'COMMITMENT_ENERGY_SHARE_HIGH')).toBe(false);
  });

  it('耗尽优先于偏重：即使占比条件也满足，状态仍是 exhausted_by_commitments', () => {
    const result = analyzeDailyCapacity(
      makeInput({
        planningWindows: [{ startAtMs: T0, endAtMs: T0 + 2 * HOUR }],
        commitments: [
          {
            id: 'full-day',
            title: '占满全天',
            window: { startAtMs: T0, endAtMs: T0 + 2 * HOUR },
            energyDemand: 5,
          },
        ],
      }),
    );
    expect(result.capacityState).toBe('exhausted_by_commitments');
  });
});

describe('analyzeDailyCapacity 可解释性与确定性', () => {
  it('reasons 携带结构化数值，不只文案', () => {
    const result = analyzeDailyCapacity(
      makeInput({
        commitments: [
          {
            id: 'standup',
            title: '晨会',
            window: { startAtMs: T0 + HOUR, endAtMs: T0 + 2 * HOUR },
            energyDemand: 2,
          },
        ],
      }),
    );
    const buffer = result.reasons.find((r) => r.code === 'PROTECTED_BUFFER_RESERVED');
    expect(buffer).toBeDefined();
    expect(buffer?.values.protectedBufferMinutes).toBe(result.protectedBufferMinutes);
    expect(buffer?.values.freeMinutes).toBe(result.freeMinutes);
    result.reasons.forEach((r) => {
      expect(r.code.length).toBeGreaterThan(0);
      expect(r.message.length).toBeGreaterThan(0);
    });
  });

  it('相同输入返回完全相同的结果（确定性）', () => {
    const first = analyzeDailyCapacity(makeInput());
    const second = analyzeDailyCapacity(makeInput());
    expect(second).toEqual(first);
  });

  it('不修改输入对象', () => {
    const input = makeInput({
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
    });
    const snapshot = JSON.stringify(input);
    analyzeDailyCapacity(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
