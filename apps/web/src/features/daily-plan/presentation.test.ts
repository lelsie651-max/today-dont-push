import { describe, expect, it } from 'vitest';
import type { DailySchedule } from '@today-dont-push/contracts';
import { describeCapacityState, groupScheduledItems, summarizeCapacity } from './presentation';

const schedule: DailySchedule = {
  policyVersion: 'task-scheduling-policy-v1',
  energyPolicyVersion: 'energy-policy-v1',
  capacity: {
    policyVersion: 'energy-policy-v1',
    totalPlanningMinutes: 540,
    fixedCommitmentMinutes: 120,
    freeMinutes: 420,
    protectedBufferMinutes: 45,
    schedulableMinutes: 375,
    baseEnergyPoints: 20,
    strainPenaltyPoints: 4,
    adjustedEnergyPoints: 16,
    commitmentEnergyCostPoints: 6,
    remainingEnergyPoints: 10,
    freeSlots: [{ startAtMs: 1_800_000_000_000, endAtMs: 1_800_001_800_000 }],
    capacityState: 'commitment_heavy',
    reasons: [],
  },
  scheduledItems: [
    {
      taskId: 'must-1',
      title: '先写开头',
      priority: 'must',
      variant: 'minimum',
      window: { startAtMs: 1_800_000_000_000, endAtMs: 1_800_000_900_000 },
      minutes: 15,
      energyCostPoints: 1,
      reasonCodes: ['MINIMUM_SELECTED_TO_PROTECT_MUST_COVERAGE'],
      decisionRank: 0,
    },
    {
      taskId: 'important-1',
      title: '整理资料',
      priority: 'important',
      variant: 'minimum',
      window: { startAtMs: 1_800_001_000_000, endAtMs: 1_800_001_900_000 },
      minutes: 15,
      energyCostPoints: 1,
      reasonCodes: ['MINIMUM_SELECTED_AS_FALLBACK'],
      decisionRank: 1,
    },
    {
      taskId: 'optional-1',
      title: '整理桌面',
      priority: 'optional',
      variant: 'full',
      window: { startAtMs: 1_800_002_000_000, endAtMs: 1_800_003_800_000 },
      minutes: 30,
      energyCostPoints: 1,
      reasonCodes: ['FULL_VERSION_SELECTED'],
      decisionRank: 2,
    },
  ],
  deferredItems: [],
  remainingSchedulableMinutes: 315,
  remainingEnergyPoints: 8,
  mustTaskDeferredIds: [],
};

describe('presentation', () => {
  it('摘要使用顶层 remainingSchedulableMinutes', () => {
    const lines = summarizeCapacity(schedule);
    expect(lines).toContain('计划排完后，还剩 5 小时 15 分钟 可安排时间。');
  });

  it('摘要使用顶层 remainingEnergyPoints', () => {
    const lines = summarizeCapacity(schedule);
    expect(lines).toContain('计划排完后剩余能量：8 点。');
  });

  it('已安排分钟数计算正确', () => {
    const lines = summarizeCapacity(schedule);
    expect(lines).toContain('这次已经安排了 1 小时。');
  });

  it('must 加 minimum 任务在摘要分类中只出现一次', () => {
    const grouped = groupScheduledItems(schedule);
    expect(grouped.mustItems).toHaveLength(1);
    expect(grouped.minimumItems).toHaveLength(1);
    expect(grouped.mustItems[0]?.taskId).toBe('must-1');
    expect(grouped.minimumItems.some((item) => item.taskId === 'must-1')).toBe(false);
  });

  it('非 must 的 minimum 进入“今天这样做就够了”', () => {
    const grouped = groupScheduledItems(schedule);
    expect(grouped.minimumItems.map((item) => item.taskId)).toEqual(['important-1']);
  });

  it('exhausted 文案不出现固定安排', () => {
    expect(describeCapacityState('exhausted_by_commitments')).toBe(
      '今天已经没有剩余的可安排容量了，能守住底线就很好。',
    );
  });
});
