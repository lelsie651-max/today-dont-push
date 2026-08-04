import { describe, expect, it } from 'vitest';
import type { FixedCommitment } from '../fixed-commitment.js';
import type { TimeWindow } from '../time.js';
import { deriveFreeSlots } from './free-slots.js';

const HOUR = 3_600_000;
const T0 = 1_800_000_000_000;

function commitment(id: string, startAtMs: number, endAtMs: number): FixedCommitment {
  return { id, title: id, window: { startAtMs, endAtMs }, energyDemand: 2 };
}

describe('deriveFreeSlots', () => {
  it('无承诺时，空闲槽位等于全部 planningWindows', () => {
    const windows: TimeWindow[] = [
      { startAtMs: T0, endAtMs: T0 + 2 * HOUR },
      { startAtMs: T0 + 4 * HOUR, endAtMs: T0 + 6 * HOUR },
    ];
    const slots = deriveFreeSlots(windows, []);
    expect(slots).toEqual(windows);
  });

  it('一个承诺把窗口切成两段', () => {
    const slots = deriveFreeSlots(
      [{ startAtMs: T0, endAtMs: T0 + 4 * HOUR }],
      [commitment('meeting', T0 + HOUR, T0 + 2 * HOUR)],
    );
    expect(slots).toEqual([
      { startAtMs: T0, endAtMs: T0 + HOUR },
      { startAtMs: T0 + 2 * HOUR, endAtMs: T0 + 4 * HOUR },
    ]);
  });

  it('多窗口多承诺：按窗口分别扣除并保持整体有序', () => {
    const slots = deriveFreeSlots(
      [
        { startAtMs: T0, endAtMs: T0 + 3 * HOUR },
        { startAtMs: T0 + 5 * HOUR, endAtMs: T0 + 8 * HOUR },
      ],
      [
        commitment('a', T0 + HOUR, T0 + 2 * HOUR),
        commitment('b', T0 + 5 * HOUR, T0 + 6 * HOUR),
        commitment('c', T0 + 7 * HOUR, T0 + 8 * HOUR),
      ],
    );
    expect(slots).toEqual([
      { startAtMs: T0, endAtMs: T0 + HOUR },
      { startAtMs: T0 + 2 * HOUR, endAtMs: T0 + 3 * HOUR },
      { startAtMs: T0 + 6 * HOUR, endAtMs: T0 + 7 * HOUR },
    ]);
  });

  it('承诺贴住窗口起点或终点时，不产生零长度槽位', () => {
    expect(
      deriveFreeSlots(
        [{ startAtMs: T0, endAtMs: T0 + 4 * HOUR }],
        [commitment('head', T0, T0 + HOUR)],
      ),
    ).toEqual([{ startAtMs: T0 + HOUR, endAtMs: T0 + 4 * HOUR }]);
    expect(
      deriveFreeSlots(
        [{ startAtMs: T0, endAtMs: T0 + 4 * HOUR }],
        [commitment('tail', T0 + 3 * HOUR, T0 + 4 * HOUR)],
      ),
    ).toEqual([{ startAtMs: T0, endAtMs: T0 + 3 * HOUR }]);
  });

  it('承诺完全覆盖窗口时，该窗口不产生任何槽位', () => {
    const slots = deriveFreeSlots(
      [
        { startAtMs: T0, endAtMs: T0 + HOUR },
        { startAtMs: T0 + 2 * HOUR, endAtMs: T0 + 3 * HOUR },
      ],
      [commitment('full', T0, T0 + HOUR)],
    );
    expect(slots).toEqual([{ startAtMs: T0 + 2 * HOUR, endAtMs: T0 + 3 * HOUR }]);
  });

  it('边界相接的两个承诺之间不产生零长度槽位', () => {
    const slots = deriveFreeSlots(
      [{ startAtMs: T0, endAtMs: T0 + 4 * HOUR }],
      [
        commitment('a', T0 + HOUR, T0 + 2 * HOUR),
        commitment('b', T0 + 2 * HOUR, T0 + 3 * HOUR),
      ],
    );
    expect(slots).toEqual([
      { startAtMs: T0, endAtMs: T0 + HOUR },
      { startAtMs: T0 + 3 * HOUR, endAtMs: T0 + 4 * HOUR },
    ]);
  });

  it('不修改输入对象', () => {
    const windows: TimeWindow[] = [{ startAtMs: T0, endAtMs: T0 + 4 * HOUR }];
    const commitments = [commitment('meeting', T0 + HOUR, T0 + 2 * HOUR)];
    const snapshot = JSON.stringify({ windows, commitments });
    deriveFreeSlots(windows, commitments);
    expect(JSON.stringify({ windows, commitments })).toBe(snapshot);
  });
});
