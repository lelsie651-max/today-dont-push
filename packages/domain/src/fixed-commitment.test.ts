import { describe, expect, it } from 'vitest';
import { createFixedCommitment } from './fixed-commitment.js';

const HOUR = 3_600_000;
const T0 = 1_800_000_000_000;

describe('createFixedCommitment', () => {
  it('构造合法固定承诺', () => {
    const result = createFixedCommitment({
      id: 'standup',
      title: '  晨会  ',
      window: { startAtMs: T0, endAtMs: T0 + HOUR },
      energyDemand: 3,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.title).toBe('晨会');
      expect(result.value.window.startAtMs).toBe(T0);
      expect(result.value.energyDemand).toBe(3);
    }
  });

  it('拒绝空标题', () => {
    const result = createFixedCommitment({
      id: 'c1',
      title: '   ',
      window: { startAtMs: T0, endAtMs: T0 + HOUR },
      energyDemand: 1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'INVALID_TEXT')).toBe(true);
    }
  });

  it('拒绝超长标题', () => {
    const result = createFixedCommitment({
      id: 'c1',
      title: '会'.repeat(101),
      window: { startAtMs: T0, endAtMs: T0 + HOUR },
      energyDemand: 1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'TEXT_TOO_LONG')).toBe(true);
    }
  });

  it.each([0, 6, 2.5, NaN])('拒绝非法 energyDemand（%s）', (demand) => {
    const result = createFixedCommitment({
      id: 'c1',
      title: '会议',
      window: { startAtMs: T0, endAtMs: T0 + HOUR },
      energyDemand: demand,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'INVALID_NUMBER')).toBe(true);
    }
  });

  it('接受 1 至 5 的全部合法 energyDemand', () => {
    for (const demand of [1, 2, 3, 4, 5]) {
      const result = createFixedCommitment({
        id: 'c1',
        title: '会议',
        window: { startAtMs: T0, endAtMs: T0 + HOUR },
        energyDemand: demand,
      });
      expect(result.ok).toBe(true);
    }
  });

  it('拒绝非法时间窗口并携带窗口路径', () => {
    const result = createFixedCommitment({
      id: 'c1',
      title: '会议',
      window: { startAtMs: T0 + HOUR, endAtMs: T0 },
      energyDemand: 2,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some(
          (e) => e.code === 'INVALID_TIME_WINDOW' && e.path === 'commitment.window',
        ),
      ).toBe(true);
    }
  });
});
