import { describe, expect, it } from 'vitest';
import { createTimeWindow, windowsOverlap, windowWithin } from './time.js';

const HOUR = 3_600_000;
// 固定的基准时间戳（领域层不读取当前时间，测试也不依赖现实时钟语义）。
const T0 = 1_800_000_000_000;

describe('createTimeWindow', () => {
  it('构造合法窗口', () => {
    const result = createTimeWindow({ startAtMs: T0, endAtMs: T0 + 2 * HOUR });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ startAtMs: T0, endAtMs: T0 + 2 * HOUR });
    }
  });

  it('接受跨午夜的有效时间戳范围（时长超过 24 小时）', () => {
    const result = createTimeWindow({ startAtMs: T0, endAtMs: T0 + 26 * HOUR });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.endAtMs - result.value.startAtMs).toBe(26 * HOUR);
    }
  });

  it.each([NaN, Number.POSITIVE_INFINITY, 1.5])('拒绝非有限安全整数的 startAtMs（%s）', (value) => {
    const result = createTimeWindow({ startAtMs: value, endAtMs: T0 + HOUR });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.code).toBe('INVALID_TIMESTAMP');
    }
  });

  it('拒绝非有限安全整数的 endAtMs', () => {
    const result = createTimeWindow({ startAtMs: T0, endAtMs: Number.NaN });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.code).toBe('INVALID_TIMESTAMP');
    }
  });

  it('拒绝 end 等于 start', () => {
    const result = createTimeWindow({ startAtMs: T0, endAtMs: T0 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.code).toBe('INVALID_TIME_WINDOW');
    }
  });

  it('拒绝 end 小于 start', () => {
    const result = createTimeWindow({ startAtMs: T0 + HOUR, endAtMs: T0 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.code).toBe('INVALID_TIME_WINDOW');
    }
  });
});

describe('窗口关系判断', () => {
  const a = { startAtMs: T0, endAtMs: T0 + 2 * HOUR };
  const b = { startAtMs: T0 + HOUR, endAtMs: T0 + 3 * HOUR };
  const c = { startAtMs: T0 + 2 * HOUR, endAtMs: T0 + 4 * HOUR };

  it('相交窗口判定为重叠', () => {
    expect(windowsOverlap(a, b)).toBe(true);
  });

  it('边界相接不算重叠', () => {
    expect(windowsOverlap(a, c)).toBe(false);
  });

  it('内部窗口判定为完全包含', () => {
    expect(windowWithin({ startAtMs: T0, endAtMs: T0 + HOUR }, a)).toBe(true);
    expect(windowWithin({ startAtMs: T0 - 1, endAtMs: T0 + HOUR }, a)).toBe(false);
  });
});
