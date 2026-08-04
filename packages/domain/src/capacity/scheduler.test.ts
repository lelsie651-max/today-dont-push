import { describe, expect, it } from 'vitest';
import type { FlexibleTask } from '../flexible-task.js';
import type { DailyPlanningInput } from '../planning.js';
import { windowWithin, windowsOverlap } from '../time.js';
import { scheduleDailyPlan } from './scheduler.js';

const HOUR = 3_600_000;
const MINUTE = 60_000;
const T0 = 1_800_000_000_000;

/** 构造一份合法的每日规划输入（默认：80 能量、无负担、单个 240 分钟窗口、无承诺、无任务）。 */
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

/** 附带 minimumVersion 的任务（full 60 分钟，minimum 15 分钟）。 */
function taskWithMinimum(overrides: Partial<FlexibleTask> = {}): FlexibleTask {
  return task({
    minimumVersion: { title: '写个开头', estimatedMinutes: 15, energyDemand: 1 },
    ...overrides,
  });
}

describe('scheduleDailyPlan 输出结构', () => {
  it('携带两个策略版本与完整容量快照', () => {
    const result = scheduleDailyPlan(makeInput({ tasks: [taskWithMinimum()] }));
    expect(result.policyVersion).toBe('task-scheduling-policy-v1');
    expect(result.energyPolicyVersion).toBe('energy-policy-v1');
    expect(result.capacity.capacityState).toBe('available');
    expect(result.scheduledItems).toHaveLength(1);
  });
});

describe('scheduleDailyPlan 三档能量的版本偏好（available）', () => {
  it('能量 80：优先 full（FULL_VERSION_SELECTED）', () => {
    const result = scheduleDailyPlan(makeInput({ tasks: [taskWithMinimum()] }));
    expect(result.scheduledItems).toHaveLength(1);
    const item = result.scheduledItems[0];
    expect(item?.variant).toBe('full');
    expect(item?.minutes).toBe(60);
    expect(item?.reasonCodes).toEqual(['FULL_VERSION_SELECTED']);
    expect(item?.window).toEqual({ startAtMs: T0, endAtMs: T0 + 60 * MINUTE });
  });

  it('能量 20：优先 minimum（MINIMUM_SELECTED_LOW_ENERGY）', () => {
    const result = scheduleDailyPlan(
      makeInput({
        checkIn: { id: 'checkin-1', energyLevel: 20, strainTags: [] },
        tasks: [taskWithMinimum()],
      }),
    );
    const item = result.scheduledItems[0];
    expect(item?.variant).toBe('minimum');
    expect(item?.minutes).toBe(15);
    // minimum 用最低版本的标题，成本 = ceil(15/30) × 1 + 0 = 1
    expect(item?.title).toBe('写个开头');
    expect(item?.energyCostPoints).toBe(1);
    expect(item?.reasonCodes).toEqual(['MINIMUM_SELECTED_LOW_ENERGY']);
  });

  it('能量 50：must 优先 full，important/optional 优先 minimum', () => {
    const must = scheduleDailyPlan(
      makeInput({
        checkIn: { id: 'checkin-1', energyLevel: 50, strainTags: [] },
        tasks: [taskWithMinimum({ id: 'must-task', priority: 'must' })],
      }),
    );
    expect(must.scheduledItems[0]?.variant).toBe('full');
    expect(must.scheduledItems[0]?.reasonCodes).toEqual(['FULL_VERSION_SELECTED']);

    const important = scheduleDailyPlan(
      makeInput({
        checkIn: { id: 'checkin-1', energyLevel: 50, strainTags: [] },
        tasks: [taskWithMinimum({ id: 'imp-task', priority: 'important' })],
      }),
    );
    expect(important.scheduledItems[0]?.variant).toBe('minimum');
    // 能量 50 的 important/optional 首选 minimum：均衡能量码，不得使用回退码
    expect(important.scheduledItems[0]?.reasonCodes).toEqual(['MINIMUM_SELECTED_BALANCED_ENERGY']);
  });

  it('能量 50：optional 首选 minimum 同样使用 BALANCED_ENERGY', () => {
    const result = scheduleDailyPlan(
      makeInput({
        checkIn: { id: 'checkin-1', energyLevel: 50, strainTags: [] },
        tasks: [taskWithMinimum({ id: 'opt-task', priority: 'optional' })],
      }),
    );
    expect(result.scheduledItems[0]?.variant).toBe('minimum');
    expect(result.scheduledItems[0]?.reasonCodes).toEqual(['MINIMUM_SELECTED_BALANCED_ENERGY']);
  });
});

describe('scheduleDailyPlan commitment_heavy 与 exhausted', () => {
  /** 构造 commitment_heavy：150 分钟 demand 5 的承诺占走一半以上能量与时间。 */
  function heavyInput(tasks: readonly FlexibleTask[]): DailyPlanningInput {
    return makeInput({
      checkIn: { id: 'checkin-1', energyLevel: 50, strainTags: [] },
      commitments: [
        {
          id: 'long-meeting',
          title: '长会',
          window: { startAtMs: T0, endAtMs: T0 + 150 * MINUTE },
          energyDemand: 5,
        },
      ],
      tasks,
    });
  }

  it('commitment_heavy：优先 minimum（MINIMUM_SELECTED_COMMITMENT_HEAVY）', () => {
    const result = scheduleDailyPlan(heavyInput([taskWithMinimum()]));
    expect(result.capacity.capacityState).toBe('commitment_heavy');
    const item = result.scheduledItems[0];
    expect(item?.variant).toBe('minimum');
    expect(item?.reasonCodes).toEqual(['MINIMUM_SELECTED_COMMITMENT_HEAVY']);
    // 放置在承诺之后的空闲槽位起点
    expect(item?.window.startAtMs).toBe(T0 + 150 * MINUTE);
  });

  it('exhausted_by_commitments：全部任务延期且不尝试任何版本', () => {
    const result = scheduleDailyPlan(
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
        tasks: [
          taskWithMinimum({ id: 'must-task', priority: 'must' }),
          task({ id: 'optional-task', priority: 'optional', energyDemand: 1 }),
        ],
      }),
    );
    expect(result.capacity.capacityState).toBe('exhausted_by_commitments');
    expect(result.scheduledItems).toEqual([]);
    expect(result.deferredItems).toHaveLength(2);
    result.deferredItems.forEach((item) => {
      expect(item.reasonCodes).toEqual(['CAPACITY_EXHAUSTED']);
      expect(item.attemptedVariants).toEqual([]);
      // exhausted 延期也携带结构化原因与相关容量数值
      expect(item.reasons).toHaveLength(1);
      expect(item.reasons[0]?.code).toBe('CAPACITY_EXHAUSTED');
      expect(item.reasons[0]?.message.length).toBeGreaterThan(0);
      expect(item.reasons[0]?.values.commitmentEnergyCostPoints).toBe(
        result.capacity.commitmentEnergyCostPoints,
      );
      expect(item.reasons[0]?.values.adjustedEnergyPoints).toBe(
        result.capacity.adjustedEnergyPoints,
      );
      expect(item.reasons[0]?.values.schedulableMinutes).toBe(result.capacity.schedulableMinutes);
      expect(item.reasonCodes).toEqual(item.reasons.map((reason) => reason.code));
    });
    // must 延期进入专门名单
    expect(result.mustTaskDeferredIds).toEqual(['must-task']);
    // 没有安排任何东西，预算保持容量分析的初始值
    expect(result.remainingSchedulableMinutes).toBe(result.capacity.schedulableMinutes);
    expect(result.remainingEnergyPoints).toBe(result.capacity.remainingEnergyPoints);
  });
});

describe('scheduleDailyPlan full 放不下时降级 minimum', () => {
  it('full 超出预算、minimum 能放下：降级成功并记录尝试过的两个版本', () => {
    // 窗口 60 分钟：free 60、buffer 10、schedulable 50；full 120 分钟放不下，minimum 15 分钟可以
    const result = scheduleDailyPlan(
      makeInput({
        planningWindows: [{ startAtMs: T0, endAtMs: T0 + 60 * MINUTE }],
        tasks: [
          taskWithMinimum({ id: 'big', estimatedMinutes: 120, energyDemand: 4 }),
        ],
      }),
    );
    const item = result.scheduledItems[0];
    expect(item?.variant).toBe('minimum');
    expect(item?.minutes).toBe(15);
    expect(item?.reasonCodes).toEqual(['MINIMUM_SELECTED_AS_FALLBACK']);
    const deferredCandidate = result.deferredItems.find((d) => d.taskId === 'big');
    expect(deferredCandidate).toBeUndefined();
  });
});

describe('scheduleDailyPlan 延期原因码', () => {
  it('INSUFFICIENT_ENERGY：剩余能量不足以承担成本', () => {
    // 能量 20 无负担：remaining 20。full 120 分钟 demand 5 resistance 3 → 4×5+6 = 26 > 20；无 minimum 只试 full
    const result = scheduleDailyPlan(
      makeInput({
        checkIn: { id: 'checkin-1', energyLevel: 20, strainTags: [] },
        tasks: [task({ id: 'heavy-task', estimatedMinutes: 120, energyDemand: 5, emotionalResistance: 3 })],
      }),
    );
    expect(result.scheduledItems).toEqual([]);
    const deferred = result.deferredItems[0];
    expect(deferred?.attemptedVariants).toEqual(['full']);
    expect(deferred?.reasonCodes).toEqual(['INSUFFICIENT_ENERGY']);
  });

  it('INSUFFICIENT_TOTAL_MINUTES：剩余可安排分钟不足', () => {
    // 窗口 100 分钟：schedulable 90；任务 120 分钟无 minimum
    const result = scheduleDailyPlan(
      makeInput({
        planningWindows: [{ startAtMs: T0, endAtMs: T0 + 100 * MINUTE }],
        tasks: [task({ id: 'long-task', estimatedMinutes: 120, energyDemand: 1 })],
      }),
    );
    expect(result.deferredItems[0]?.reasonCodes).toEqual(['INSUFFICIENT_TOTAL_MINUTES']);
  });

  it('NO_CONTIGUOUS_SLOT：总预算足够但没有任何连续槽位容纳', () => {
    // 两个 60 分钟窗口：free 120、schedulable 105；任务 90 分钟放不进任何单个槽位
    const result = scheduleDailyPlan(
      makeInput({
        planningWindows: [
          { startAtMs: T0, endAtMs: T0 + 60 * MINUTE },
          { startAtMs: T0 + 2 * HOUR, endAtMs: T0 + 3 * HOUR },
        ],
        tasks: [task({ id: 'wide-task', estimatedMinutes: 90, energyDemand: 1 })],
      }),
    );
    expect(result.scheduledItems).toEqual([]);
    expect(result.deferredItems[0]?.reasonCodes).toEqual(['NO_CONTIGUOUS_SLOT']);
  });

  it('DEADLINE_CANNOT_BE_MET：最早放置也晚于截止时间', () => {
    // full 60 分钟从 T0 开始也要到 T0+60min，晚于 T0+30min 的截止；无 minimum
    const result = scheduleDailyPlan(
      makeInput({
        tasks: [
          task({ id: 'urgent', estimatedMinutes: 60, energyDemand: 1, deadlineAtMs: T0 + 30 * MINUTE }),
        ],
      }),
    );
    expect(result.scheduledItems).toEqual([]);
    expect(result.deferredItems[0]?.reasonCodes).toEqual(['DEADLINE_CANNOT_BE_MET']);
  });

  it('deadline 挡住 full 时，minimum 能在截止前完成则降级放置', () => {
    const result = scheduleDailyPlan(
      makeInput({
        tasks: [
          taskWithMinimum({
            id: 'urgent',
            estimatedMinutes: 60,
            energyDemand: 3,
            deadlineAtMs: T0 + 30 * MINUTE,
          }),
        ],
      }),
    );
    const item = result.scheduledItems[0];
    expect(item?.variant).toBe('minimum');
    expect(item?.window.endAtMs).toBeLessThanOrEqual(T0 + 30 * MINUTE);
    expect(item?.reasonCodes).toEqual(['MINIMUM_SELECTED_AS_FALLBACK']);
  });
});

describe('scheduleDailyPlan 任务顺序', () => {
  it('priority → 有 deadline 优先 → deadline 越早越优先', () => {
    const result = scheduleDailyPlan(
      makeInput({
        tasks: [
          task({ id: 'opt', priority: 'optional', estimatedMinutes: 30, energyDemand: 1 }),
          task({
            id: 'imp-late',
            priority: 'important',
            estimatedMinutes: 30,
            energyDemand: 1,
            deadlineAtMs: T0 + 3 * HOUR,
          }),
          task({ id: 'must-task', priority: 'must', estimatedMinutes: 30, energyDemand: 1 }),
          task({
            id: 'imp-early',
            priority: 'important',
            estimatedMinutes: 30,
            energyDemand: 1,
            deadlineAtMs: T0 + 2 * HOUR,
          }),
        ],
      }),
    );
    expect(result.scheduledItems.map((item) => item.taskId)).toEqual([
      'must-task',
      'imp-early',
      'imp-late',
      'opt',
    ]);
  });

  it('完全同键的任务保持原输入顺序（稳定排序）', () => {
    const result = scheduleDailyPlan(
      makeInput({
        tasks: [
          task({ id: 'first', priority: 'must', estimatedMinutes: 30, energyDemand: 1 }),
          task({ id: 'second', priority: 'must', estimatedMinutes: 30, energyDemand: 1 }),
        ],
      }),
    );
    expect(result.scheduledItems.map((item) => item.taskId)).toEqual(['first', 'second']);
    expect(result.scheduledItems[0]?.window.startAtMs).toBe(T0);
    expect(result.scheduledItems[1]?.window.startAtMs).toBe(T0 + 30 * MINUTE);
  });
});

describe('scheduleDailyPlan 放置不变量', () => {
  it('多任务不重叠且均完整落在某个空闲槽位内', () => {
    const input = makeInput({
      commitments: [
        {
          id: 'standup',
          title: '晨会',
          window: { startAtMs: T0 + HOUR, endAtMs: T0 + 2 * HOUR },
          energyDemand: 1,
        },
      ],
      tasks: [
        task({ id: 'a', priority: 'must', estimatedMinutes: 60, energyDemand: 1 }),
        task({ id: 'b', priority: 'important', estimatedMinutes: 45, energyDemand: 1 }),
        task({ id: 'c', priority: 'optional', estimatedMinutes: 45, energyDemand: 1 }),
      ],
    });
    const result = scheduleDailyPlan(input);
    expect(result.scheduledItems).toHaveLength(3);

    // 每个已安排窗口完整位于某个空闲槽位内
    result.scheduledItems.forEach((item) => {
      const withinSomeSlot = result.capacity.freeSlots.some((slot) =>
        windowWithin(item.window, slot),
      );
      expect(withinSomeSlot).toBe(true);
    });

    // 任意两个已安排窗口互不重叠（边界相接合法）
    for (let i = 0; i < result.scheduledItems.length; i += 1) {
      for (let j = i + 1; j < result.scheduledItems.length; j += 1) {
        const a = result.scheduledItems[i];
        const b = result.scheduledItems[j];
        if (a !== undefined && b !== undefined) {
          expect(windowsOverlap(a.window, b.window)).toBe(false);
        }
      }
    }

    // 60 分钟任务放进第一段槽位；两个 45 分钟任务被承诺挡到第二段槽位
    expect(result.scheduledItems[0]?.window).toEqual({ startAtMs: T0, endAtMs: T0 + HOUR });
    expect(result.scheduledItems[1]?.window.startAtMs).toBe(T0 + 2 * HOUR);
  });

  it('保护性空白永不被占用：已安排总分钟不超过 schedulableMinutes', () => {
    // 窗口 100 分钟：buffer 10、schedulable 90。90 分钟任务恰好用满，第二个任务因总分钟不足延期
    const result = scheduleDailyPlan(
      makeInput({
        planningWindows: [{ startAtMs: T0, endAtMs: T0 + 100 * MINUTE }],
        tasks: [
          task({ id: 'fill', priority: 'must', estimatedMinutes: 90, energyDemand: 1 }),
          task({ id: 'extra', priority: 'optional', estimatedMinutes: 30, energyDemand: 1 }),
        ],
      }),
    );
    expect(result.capacity.protectedBufferMinutes).toBe(10);
    expect(result.scheduledItems.map((item) => item.taskId)).toEqual(['fill']);
    const scheduledMinutes = result.scheduledItems.reduce((sum, item) => sum + item.minutes, 0);
    expect(scheduledMinutes).toBe(result.capacity.schedulableMinutes);
    expect(result.remainingSchedulableMinutes).toBe(0);
    expect(result.deferredItems[0]?.reasonCodes).toEqual(['INSUFFICIENT_TOTAL_MINUTES']);
    // 已安排窗口没有侵入保护性空白的量化证据：90 分钟 < 100 分钟空闲
    expect(scheduledMinutes).toBeLessThan(result.capacity.freeMinutes);
  });
});

describe('scheduleDailyPlan 确定性与不可变性', () => {
  it('相同输入返回完全相同的结果', () => {
    const build = (): DailyPlanningInput =>
      makeInput({
        commitments: [
          {
            id: 'standup',
            title: '晨会',
            window: { startAtMs: T0 + HOUR, endAtMs: T0 + 2 * HOUR },
            energyDemand: 2,
          },
        ],
        tasks: [
          taskWithMinimum({ id: 'a', priority: 'must' }),
          task({ id: 'b', priority: 'optional', estimatedMinutes: 30, energyDemand: 1 }),
        ],
      });
    expect(scheduleDailyPlan(build())).toEqual(scheduleDailyPlan(build()));
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
      tasks: [taskWithMinimum({ id: 'a', priority: 'must' })],
    });
    const snapshot = JSON.stringify(input);
    scheduleDailyPlan(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it('结果的窗口对象与输入槽位互不为同一引用（不暴露内部可变结构）', () => {
    const input = makeInput({ tasks: [task({ estimatedMinutes: 30, energyDemand: 1 })] });
    const result = scheduleDailyPlan(input);
    const item = result.scheduledItems[0];
    expect(item).toBeDefined();
    if (item !== undefined) {
      const sharesReference = result.capacity.freeSlots.some((slot) => slot === item.window);
      expect(sharesReference).toBe(false);
    }
  });
});

describe('scheduleDailyPlan must 两阶段保护', () => {
  it('两个 must 各 90 分钟 full / 30 分钟 minimum、可安排 105 分钟：两个最低版都安排', () => {
    // 窗口 120 分钟、能量 80：buffer 15、schedulable 105。
    // 逐项贪心 full-first 会让第一个 must 的 full（90）耗尽预算，导致第二个 must 连 minimum 都排不上；
    // 两阶段策略必须先保证两个 must 的 minimum 基线（60 分钟），升级均被拒绝。
    const mustTask = (id: string): FlexibleTask =>
      task({
        id,
        priority: 'must',
        estimatedMinutes: 90,
        energyDemand: 2,
        minimumVersion: { title: `${id} 最低版`, estimatedMinutes: 30, energyDemand: 1 },
      });
    const result = scheduleDailyPlan(
      makeInput({
        planningWindows: [{ startAtMs: T0, endAtMs: T0 + 120 * MINUTE }],
        tasks: [mustTask('must-a'), mustTask('must-b')],
      }),
    );
    expect(result.capacity.schedulableMinutes).toBe(105);
    expect(result.scheduledItems.map((item) => item.taskId)).toEqual(['must-a', 'must-b']);
    result.scheduledItems.forEach((item) => {
      expect(item.variant).toBe('minimum');
      expect(item.minutes).toBe(30);
    });
    expect(result.deferredItems).toEqual([]);
    expect(result.mustTaskDeferredIds).toEqual([]);
    // must-a 的 full 会挤掉 must-b 的基线 → 保护覆盖率码；
    // must-b 的 full 在 must-a 基线之后自身放不下 → 回退码。
    expect(result.scheduledItems[0]?.reasonCodes).toEqual([
      'MINIMUM_SELECTED_TO_PROTECT_MUST_COVERAGE',
    ]);
    expect(result.scheduledItems[1]?.reasonCodes).toEqual(['MINIMUM_SELECTED_AS_FALLBACK']);
  });

  it('资源足够时，must 仍可逐个升级为 full', () => {
    // 默认 240 分钟窗口、能量 80：schedulable 215，两个 must 的 full（60+60）都放得下。
    const mustTask = (id: string): FlexibleTask =>
      task({
        id,
        priority: 'must',
        estimatedMinutes: 60,
        energyDemand: 2,
        minimumVersion: { title: `${id} 最低版`, estimatedMinutes: 15, energyDemand: 1 },
      });
    const result = scheduleDailyPlan(
      makeInput({ tasks: [mustTask('must-a'), mustTask('must-b')] }),
    );
    expect(result.scheduledItems.map((item) => item.taskId)).toEqual(['must-a', 'must-b']);
    result.scheduledItems.forEach((item) => {
      expect(item.variant).toBe('full');
      expect(item.minutes).toBe(60);
      expect(item.reasonCodes).toEqual(['FULL_VERSION_SELECTED']);
    });
    expect(result.scheduledItems[0]?.window).toEqual({ startAtMs: T0, endAtMs: T0 + 60 * MINUTE });
    expect(result.scheduledItems[1]?.window).toEqual({
      startAtMs: T0 + 60 * MINUTE,
      endAtMs: T0 + 120 * MINUTE,
    });
    expect(result.deferredItems).toEqual([]);
  });

  it('一个 must 基线无法安排时，不阻止后续较短的 must', () => {
    // 窗口 60 分钟、能量 80：schedulable 50。
    // must-big 的基线（minimum 60 分钟）放不下，但不得终止流程；must-short 仍被安排。
    const result = scheduleDailyPlan(
      makeInput({
        planningWindows: [{ startAtMs: T0, endAtMs: T0 + 60 * MINUTE }],
        tasks: [
          task({
            id: 'must-big',
            priority: 'must',
            estimatedMinutes: 90,
            energyDemand: 1,
            minimumVersion: { title: '大任务最低版', estimatedMinutes: 60, energyDemand: 1 },
          }),
          task({ id: 'must-short', priority: 'must', estimatedMinutes: 40, energyDemand: 1 }),
        ],
      }),
    );
    expect(result.scheduledItems.map((item) => item.taskId)).toEqual(['must-short']);
    expect(result.scheduledItems[0]?.variant).toBe('full');
    expect(result.scheduledItems[0]?.reasonCodes).toEqual(['FULL_VERSION_SELECTED']);
    const deferred = result.deferredItems.find((item) => item.taskId === 'must-big');
    expect(deferred?.reasonCodes).toEqual(['INSUFFICIENT_TOTAL_MINUTES']);
    expect(result.mustTaskDeferredIds).toEqual(['must-big']);
  });

  it('must 偏好 full 但 full 真实尝试失败时保留 minimum 并使用 FALLBACK', () => {
    // 窗口 60 分钟、能量 80：schedulable 50。full 60 分钟超预算（真实失败），minimum 15 分钟放下。
    const result = scheduleDailyPlan(
      makeInput({
        planningWindows: [{ startAtMs: T0, endAtMs: T0 + 60 * MINUTE }],
        tasks: [
          taskWithMinimum({ id: 'must-task', priority: 'must', estimatedMinutes: 60, energyDemand: 2 }),
        ],
      }),
    );
    const item = result.scheduledItems[0];
    expect(item?.variant).toBe('minimum');
    expect(item?.reasonCodes).toEqual(['MINIMUM_SELECTED_AS_FALLBACK']);
  });
});

describe('scheduleDailyPlan 决策顺序与时间线输出', () => {
  it('前一个决策放到下午、后一个决策放到上午：最终按时间排序且 decisionRank 保留决策顺序', () => {
    // 承诺占据中段：空闲槽位 = [T0, T0+30min] 与 [T0+2h, T0+4h]。
    // must（60 分钟）先决策但只能放进下午槽位；important（30 分钟）后决策却放进上午槽位。
    const result = scheduleDailyPlan(
      makeInput({
        commitments: [
          {
            id: 'meeting',
            title: '会议',
            window: { startAtMs: T0 + 30 * MINUTE, endAtMs: T0 + 2 * HOUR },
            energyDemand: 1,
          },
        ],
        tasks: [
          task({ id: 'must-task', priority: 'must', estimatedMinutes: 60, energyDemand: 1 }),
          task({ id: 'imp-task', priority: 'important', estimatedMinutes: 30, energyDemand: 1 }),
        ],
      }),
    );
    expect(result.scheduledItems.map((item) => item.taskId)).toEqual(['imp-task', 'must-task']);
    expect(result.scheduledItems[0]?.decisionRank).toBe(1);
    expect(result.scheduledItems[1]?.decisionRank).toBe(0);
    expect(result.scheduledItems[0]?.window).toEqual({
      startAtMs: T0,
      endAtMs: T0 + 30 * MINUTE,
    });
    expect(result.scheduledItems[1]?.window).toEqual({
      startAtMs: T0 + 2 * HOUR,
      endAtMs: T0 + 3 * HOUR,
    });
  });
});

describe('scheduleDailyPlan 延期原因结构', () => {
  it('reasons 包含 message 与 values，reasonCodes 从 reasons 去重派生且严格一致', () => {
    // 两个 60 分钟窗口、能量 20：schedulable 80、剩余能量 20。
    // 能量 20 先试 minimum（90 分钟 → INSUFFICIENT_TOTAL_MINUTES），再试 full（成本 26 → INSUFFICIENT_ENERGY）。
    const result = scheduleDailyPlan(
      makeInput({
        checkIn: { id: 'checkin-1', energyLevel: 20, strainTags: [] },
        planningWindows: [
          { startAtMs: T0, endAtMs: T0 + 60 * MINUTE },
          { startAtMs: T0 + 2 * HOUR, endAtMs: T0 + 3 * HOUR },
        ],
        tasks: [
          task({
            id: 'blocked',
            estimatedMinutes: 120,
            energyDemand: 5,
            emotionalResistance: 3,
            minimumVersion: { title: '最低版', estimatedMinutes: 90, energyDemand: 1 },
          }),
        ],
      }),
    );
    const deferred = result.deferredItems[0];
    expect(deferred?.attemptedVariants).toEqual(['minimum', 'full']);
    expect(deferred?.reasons).toHaveLength(2);
    deferred?.reasons.forEach((reason) => {
      expect(reason.message.length).toBeGreaterThan(0);
      expect(Object.values(reason.values).every((value) => typeof value === 'number')).toBe(true);
    });
    expect(deferred?.reasons.map((reason) => reason.code)).toEqual([
      'INSUFFICIENT_TOTAL_MINUTES',
      'INSUFFICIENT_ENERGY',
    ]);
    expect(deferred?.reasons[0]?.values.requiredMinutes).toBe(90);
    expect(deferred?.reasons[1]?.values.requiredEnergyPoints).toBe(26);
    expect(deferred?.reasons[1]?.values.remainingEnergyPoints).toBe(20);
    // reasonCodes 与 reasons 严格一致（去重保序派生）
    expect(deferred?.reasonCodes).toEqual(deferred?.reasons.map((reason) => reason.code));
  });
});
