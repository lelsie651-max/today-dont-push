import { describe, expect, it } from 'vitest';
import type { FixedCommitment } from '../fixed-commitment.js';
import type { FlexibleTask } from '../flexible-task.js';
import {
  commitmentEnergyCostPoints,
  durationInWholeMinutes,
  estimateTaskEnergyCost,
} from './energy-cost.js';

const HOUR = 3_600_000;
const MINUTE = 60_000;
const T0 = 1_800_000_000_000;

function commitment(minutes: number, energyDemand: number): FixedCommitment {
  return {
    id: 'c1',
    title: '承诺',
    window: { startAtMs: T0, endAtMs: T0 + minutes * MINUTE },
    energyDemand,
  };
}

function task(overrides: Partial<FlexibleTask> = {}): FlexibleTask {
  return {
    id: 'task-1',
    title: '写周报',
    priority: 'important',
    estimatedMinutes: 60,
    energyDemand: 3,
    emotionalResistance: 0,
    ...overrides,
  };
}

describe('durationInWholeMinutes', () => {
  it('低于一分钟的余数向下取整', () => {
    expect(durationInWholeMinutes({ startAtMs: T0, endAtMs: T0 + 61 * MINUTE + 30_000 })).toBe(61);
    expect(durationInWholeMinutes({ startAtMs: T0, endAtMs: T0 + HOUR })).toBe(60);
  });
});

describe('commitmentEnergyCostPoints', () => {
  it('整块时长：ceil(60/30) × 3 = 6', () => {
    expect(commitmentEnergyCostPoints(commitment(60, 3))).toBe(6);
  });

  it('不足整块按整块向上取整：ceil(45/30) × 2 = 4', () => {
    expect(commitmentEnergyCostPoints(commitment(45, 2))).toBe(4);
  });

  it('不满 30 分钟也按一块结算：ceil(29/30) × 1 = 1', () => {
    expect(commitmentEnergyCostPoints(commitment(29, 1))).toBe(1);
  });

  it('先向下取整完整分钟，再按块结算：61.5 分钟 → 61 → ceil(61/30) = 3 块', () => {
    const longCommitment: FixedCommitment = {
      id: 'c2',
      title: '长承诺',
      window: { startAtMs: T0, endAtMs: T0 + 61 * MINUTE + 30_000 },
      energyDemand: 2,
    };
    expect(commitmentEnergyCostPoints(longCommitment)).toBe(6);
  });
});

describe('estimateTaskEnergyCost', () => {
  it('full：ceil(60/30) × 3 + 2 × 2 = 10', () => {
    const result = estimateTaskEnergyCost(task({ emotionalResistance: 2 }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.variant).toBe('full');
      expect(result.value.minutes).toBe(60);
      expect(result.value.costPoints).toBe(10);
    }
  });

  it('full 不满 30 分钟按一块结算，emotionalResistance 为 0 时无附加', () => {
    const result = estimateTaskEnergyCost(task({ estimatedMinutes: 5, energyDemand: 4 }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.costPoints).toBe(4);
    }
  });

  it('minimum：使用最低版本的时间与 energyDemand，但保留原任务的 emotionalResistance', () => {
    const result = estimateTaskEnergyCost(
      task({
        estimatedMinutes: 120,
        energyDemand: 4,
        emotionalResistance: 3,
        minimumVersion: { title: '写个开头', estimatedMinutes: 15, energyDemand: 1 },
      }),
      'minimum',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      // ceil(15/30) × 1 + 3 × 2 = 7（而不是用原任务的 120 分钟与 4 点）
      expect(result.value.variant).toBe('minimum');
      expect(result.value.minutes).toBe(15);
      expect(result.value.energyDemand).toBe(1);
      expect(result.value.emotionalResistance).toBe(3);
      expect(result.value.costPoints).toBe(7);
    }
  });

  it('没有 minimumVersion 时请求 minimum，返回结构化错误且不抛异常', () => {
    const result = estimateTaskEnergyCost(task(), 'minimum');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.code).toBe('MINIMUM_VERSION_MISSING');
      expect(result.errors[0]?.path).toBe('task.minimumVersion');
    }
  });
});
