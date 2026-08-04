/**
 * 空闲槽位推导。
 *
 * 从已排序的 planningWindows 中扣除固定承诺窗口，得到真正可安置
 * 弹性任务的空闲槽位。纯函数：不修改输入对象，不读取当前时间。
 */
import { windowsOverlap, type TimeWindow } from '../time.js';
import type { FixedCommitment } from '../fixed-commitment.js';

/**
 * 推导空闲槽位。
 *
 * 性质：
 * - 一个承诺可以把一个窗口切成前后两段；
 * - 支持多个窗口、多个承诺、边界相接；
 * - 返回按开始时间排序、互不重叠的 TimeWindow，且不产生零长度槽位；
 * - 承诺若（理论上）越出窗口边界，按窗口边界裁剪，不会污染相邻窗口。
 */
export function deriveFreeSlots(
  planningWindows: readonly TimeWindow[],
  commitments: readonly FixedCommitment[],
): TimeWindow[] {
  const slots: TimeWindow[] = [];
  for (const window of planningWindows) {
    // 收集落入本窗口的承诺段（裁剪到窗口边界），按开始时间排序。
    const occupied = commitments
      .filter((commitment) => windowsOverlap(window, commitment.window))
      .map((commitment) => ({
        startAtMs: Math.max(window.startAtMs, commitment.window.startAtMs),
        endAtMs: Math.min(window.endAtMs, commitment.window.endAtMs),
      }))
      .sort((a, b) => a.startAtMs - b.startAtMs);

    let cursor = window.startAtMs;
    for (const segment of occupied) {
      if (segment.startAtMs > cursor) {
        slots.push({ startAtMs: cursor, endAtMs: segment.startAtMs });
      }
      cursor = Math.max(cursor, segment.endAtMs);
    }
    if (cursor < window.endAtMs) {
      slots.push({ startAtMs: cursor, endAtMs: window.endAtMs });
    }
  }
  return slots;
}
