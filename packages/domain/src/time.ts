/**
 * 时间范围值对象。
 *
 * 领域层不读取当前时间、不处理时区：时间一律由外部以毫秒时间戳传入，
 * 领域只校验其形态与先后关系。
 */
import { error, ok, type DomainResult } from './shared.js';

/** 时间窗口：外部传入的毫秒时间戳区间 [startAtMs, endAtMs)。 */
export interface TimeWindow {
  readonly startAtMs: number;
  readonly endAtMs: number;
}

/** TimeWindow 工厂入参。 */
export interface TimeWindowInput {
  readonly startAtMs: number;
  readonly endAtMs: number;
}

function isFiniteSafeInteger(value: number): boolean {
  return typeof value === 'number' && Number.isFinite(value) && Number.isSafeInteger(value);
}

/**
 * 构造时间窗口。
 *
 * 不变量：
 * - startAtMs / endAtMs 必须为有限的安全整数；
 * - endAtMs 必须严格大于 startAtMs。
 */
export function createTimeWindow(
  input: TimeWindowInput,
  path = 'window',
): DomainResult<TimeWindow> {
  if (!isFiniteSafeInteger(input.startAtMs)) {
    return {
      ok: false,
      errors: [error('INVALID_TIMESTAMP', `${path}.startAtMs`, 'startAtMs 必须为有限的安全整数')],
    };
  }
  if (!isFiniteSafeInteger(input.endAtMs)) {
    return {
      ok: false,
      errors: [error('INVALID_TIMESTAMP', `${path}.endAtMs`, 'endAtMs 必须为有限的安全整数')],
    };
  }
  if (input.endAtMs <= input.startAtMs) {
    return {
      ok: false,
      errors: [error('INVALID_TIME_WINDOW', path, 'endAtMs 必须严格大于 startAtMs')],
    };
  }
  return ok({ startAtMs: input.startAtMs, endAtMs: input.endAtMs });
}

/** 两个时间窗口是否重叠（边界相接不算重叠）。 */
export function windowsOverlap(a: TimeWindow, b: TimeWindow): boolean {
  return a.startAtMs < b.endAtMs && b.startAtMs < a.endAtMs;
}

/** 窗口 inner 是否完全位于窗口 outer 内。 */
export function windowWithin(inner: TimeWindow, outer: TimeWindow): boolean {
  return inner.startAtMs >= outer.startAtMs && inner.endAtMs <= outer.endAtMs;
}
