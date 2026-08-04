import { describe, expect, it } from 'vitest';
import { createFlexibleTask } from './flexible-task.js';

const T0 = 1_800_000_000_000;

function validInput() {
  return {
    id: 'task-1',
    title: '写周报',
    priority: 'important',
    estimatedMinutes: 60,
    energyDemand: 3,
    emotionalResistance: 1,
  };
}

describe('createFlexibleTask', () => {
  it('构造合法任务（含 deadline 与最低版本）', () => {
    const result = createFlexibleTask({
      ...validInput(),
      deadlineAtMs: T0 + 86_400_000,
      minimumVersion: { title: '列三条要点', estimatedMinutes: 10, energyDemand: 1 },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.minimumVersion?.estimatedMinutes).toBe(10);
      expect(result.value.deadlineAtMs).toBe(T0 + 86_400_000);
    }
  });

  it('构造不含可选字段的任务', () => {
    const result = createFlexibleTask(validInput());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.deadlineAtMs).toBeUndefined();
      expect(result.value.minimumVersion).toBeUndefined();
    }
  });

  it.each(['urgent', '', 'MUST'])('拒绝非法 priority（%s）', (priority) => {
    const result = createFlexibleTask({ ...validInput(), priority });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'INVALID_PRIORITY')).toBe(true);
    }
  });

  it('接受全部三种合法 priority', () => {
    for (const priority of ['must', 'important', 'optional']) {
      expect(createFlexibleTask({ ...validInput(), priority }).ok).toBe(true);
    }
  });

  it.each([4, 481, 30.5, NaN])('拒绝非法 estimatedMinutes（%s）', (minutes) => {
    const result = createFlexibleTask({ ...validInput(), estimatedMinutes: minutes });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'INVALID_NUMBER')).toBe(true);
    }
  });

  it('接受边界耗时 5 与 480', () => {
    expect(createFlexibleTask({ ...validInput(), estimatedMinutes: 5 }).ok).toBe(true);
    expect(createFlexibleTask({ ...validInput(), estimatedMinutes: 480 }).ok).toBe(true);
  });

  it.each([0, 6])('拒绝非法 energyDemand（%s）', (demand) => {
    const result = createFlexibleTask({ ...validInput(), energyDemand: demand });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'INVALID_NUMBER')).toBe(true);
    }
  });

  it.each([-1, 4, 1.5])('拒绝非法 emotionalResistance（%s）', (resistance) => {
    const result = createFlexibleTask({ ...validInput(), emotionalResistance: resistance });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'INVALID_NUMBER')).toBe(true);
    }
  });

  it('接受边界心理阻力 0 与 3', () => {
    expect(createFlexibleTask({ ...validInput(), emotionalResistance: 0 }).ok).toBe(true);
    expect(createFlexibleTask({ ...validInput(), emotionalResistance: 3 }).ok).toBe(true);
  });

  it('拒绝非有限安全整数的 deadlineAtMs', () => {
    const result = createFlexibleTask({ ...validInput(), deadlineAtMs: Number.NaN });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'INVALID_TIMESTAMP')).toBe(true);
    }
  });

  it('拒绝耗时比原任务更重的最低版本', () => {
    const result = createFlexibleTask({
      ...validInput(),
      estimatedMinutes: 60,
      minimumVersion: { title: '降级版', estimatedMinutes: 90, energyDemand: 1 },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some(
          (e) => e.code === 'MINIMUM_VERSION_TOO_HEAVY' && e.path.includes('estimatedMinutes'),
        ),
      ).toBe(true);
    }
  });

  it('拒绝能量比原任务更重的最低版本', () => {
    const result = createFlexibleTask({
      ...validInput(),
      energyDemand: 2,
      minimumVersion: { title: '降级版', estimatedMinutes: 10, energyDemand: 4 },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some(
          (e) => e.code === 'MINIMUM_VERSION_TOO_HEAVY' && e.path.includes('energyDemand'),
        ),
      ).toBe(true);
    }
  });

  it('最低版本与原任务相等时合法（不得高于，可以相等）', () => {
    const result = createFlexibleTask({
      ...validInput(),
      minimumVersion: { title: '降级版', estimatedMinutes: 60, energyDemand: 3 },
    });
    expect(result.ok).toBe(true);
  });

  it('拒绝空标题的最低版本', () => {
    const result = createFlexibleTask({
      ...validInput(),
      minimumVersion: { title: '  ', estimatedMinutes: 10, energyDemand: 1 },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some(
          (e) => e.code === 'INVALID_TEXT' && e.path === 'task.minimumVersion.title',
        ),
      ).toBe(true);
    }
  });
});
