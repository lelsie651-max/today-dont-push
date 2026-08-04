/**
 * 确定性任务决策与时段放置（调度引擎第二阶段）。
 *
 * 在容量分析（第一阶段）之上决定：哪些任务今天做、用哪个版本（full / minimum）、
 * 放在哪个空闲槽位。纯函数：相同输入必然返回完全相同的结果；不读取当前时间、
 * 不使用随机数；不修改输入对象；不拆分任务、不允许任务跨槽位执行。
 *
 * 规则说明见 docs/product/task-scheduling-policy-v1.md。
 */
import type { TimeWindow } from '../time.js';
import type { DailyPlanningInput } from '../planning.js';
import type { EnergyLevel } from '../check-in.js';
import type { TaskPriority } from '../flexible-task.js';
import {
  ENERGY_POLICY_V1,
  type EnergyPolicy,
  type EnergyPolicyVersion,
} from './energy-policy.js';
import { analyzeDailyCapacity, type CapacityAnalysis } from './analyzer.js';
import { estimateTaskEnergyCost, type TaskCostVariant } from './energy-cost.js';

const MS_PER_MINUTE = 60_000;

/** 调度策略版本号。 */
export type TaskSchedulingPolicyVersion = 'task-scheduling-policy-v1';

/** 按优先级区分的版本尝试顺序。 */
export interface VariantPreferenceByPriority {
  readonly must: readonly TaskCostVariant[];
  readonly important: readonly TaskCostVariant[];
  readonly optional: readonly TaskCostVariant[];
}

/** 调度策略：任务排序、版本偏好等全部可调规则。 */
export interface TaskSchedulingPolicy {
  readonly version: TaskSchedulingPolicyVersion;
  /** priority 排序权重：靠前者优先。 */
  readonly priorityOrder: readonly TaskPriority[];
  /** 各容量状态 × 能量档位下的版本尝试顺序（数组内依次尝试，先到先得）。 */
  readonly variantPreference: {
    readonly exhaustedByCommitments: readonly TaskCostVariant[];
    readonly commitmentHeavy: readonly TaskCostVariant[];
    readonly availableByEnergy: Readonly<Record<EnergyLevel, VariantPreferenceByPriority>>;
  };
}

/** 当前唯一启用的调度策略版本。 */
export const TASK_SCHEDULING_POLICY_V1: TaskSchedulingPolicy = {
  version: 'task-scheduling-policy-v1',
  priorityOrder: ['must', 'important', 'optional'],
  variantPreference: {
    // exhausted：不安排任何任务（空数组，全部延期）。
    exhaustedByCommitments: [],
    // commitment_heavy：有 minimum 时先尝试 minimum，再 full。
    commitmentHeavy: ['minimum', 'full'],
    availableByEnergy: {
      // 能量 20：一律 minimum → full。
      20: {
        must: ['minimum', 'full'],
        important: ['minimum', 'full'],
        optional: ['minimum', 'full'],
      },
      // 能量 50：must 先 full（重要的事趁还有力气做完整版）；其他 minimum → full。
      50: {
        must: ['full', 'minimum'],
        important: ['minimum', 'full'],
        optional: ['minimum', 'full'],
      },
      // 能量 80：一律 full → minimum。
      80: {
        must: ['full', 'minimum'],
        important: ['full', 'minimum'],
        optional: ['full', 'minimum'],
      },
    },
  },
};

/** 延期原因码。 */
export type ScheduleDeferredReasonCode =
  | 'CAPACITY_EXHAUSTED'
  | 'INSUFFICIENT_ENERGY'
  | 'INSUFFICIENT_TOTAL_MINUTES'
  | 'NO_CONTIGUOUS_SLOT'
  | 'DEADLINE_CANNOT_BE_MET';

/** 安排原因码。 */
export type SchedulePlacementReasonCode =
  | 'FULL_VERSION_SELECTED'
  | 'MINIMUM_SELECTED_LOW_ENERGY'
  | 'MINIMUM_SELECTED_COMMITMENT_HEAVY'
  | 'MINIMUM_SELECTED_AS_FALLBACK';

/** 延期原因：机器可读 code + 展示文案 + 相关数值。 */
export interface ScheduleDeferredReason {
  readonly code: ScheduleDeferredReasonCode;
  readonly message: string;
  readonly values: Readonly<Record<string, number>>;
}

/** 已成功放置的任务。 */
export interface ScheduledItem {
  readonly taskId: string;
  readonly title: string;
  readonly priority: TaskPriority;
  readonly variant: TaskCostVariant;
  readonly window: TimeWindow;
  readonly minutes: number;
  readonly energyCostPoints: number;
  readonly reasonCodes: readonly SchedulePlacementReasonCode[];
}

/** 被延期的任务。 */
export interface DeferredItem {
  readonly taskId: string;
  readonly priority: TaskPriority;
  readonly attemptedVariants: readonly TaskCostVariant[];
  readonly reasonCodes: readonly ScheduleDeferredReasonCode[];
}

/** 每日调度结果。 */
export interface DailySchedule {
  readonly policyVersion: TaskSchedulingPolicyVersion;
  readonly energyPolicyVersion: EnergyPolicyVersion;
  readonly capacity: CapacityAnalysis;
  readonly scheduledItems: readonly ScheduledItem[];
  readonly deferredItems: readonly DeferredItem[];
  readonly remainingSchedulableMinutes: number;
  readonly remainingEnergyPoints: number;
  /** 被延期的 must 任务 id——产品需要专门对它们说话。 */
  readonly mustTaskDeferredIds: readonly string[];
}

/** 稳定排序键：priority 权重 → 有 deadline 优先 → deadline 越早越优先 → 原输入顺序。 */
function compareTasks(
  a: { task: { priority: TaskPriority; deadlineAtMs?: number }; originalIndex: number },
  b: { task: { priority: TaskPriority; deadlineAtMs?: number }; originalIndex: number },
  policy: TaskSchedulingPolicy,
): number {
  const priorityDiff =
    policy.priorityOrder.indexOf(a.task.priority) - policy.priorityOrder.indexOf(b.task.priority);
  if (priorityDiff !== 0) {
    return priorityDiff;
  }
  const aHasDeadline = a.task.deadlineAtMs !== undefined;
  const bHasDeadline = b.task.deadlineAtMs !== undefined;
  if (aHasDeadline !== bHasDeadline) {
    return aHasDeadline ? -1 : 1;
  }
  if (
    aHasDeadline &&
    bHasDeadline &&
    a.task.deadlineAtMs !== undefined &&
    b.task.deadlineAtMs !== undefined
  ) {
    const deadlineDiff = a.task.deadlineAtMs - b.task.deadlineAtMs;
    if (deadlineDiff !== 0) {
      return deadlineDiff;
    }
  }
  return a.originalIndex - b.originalIndex;
}

/** 按容量状态与能量档位选出该任务的版本尝试顺序（无 minimum 时只保留 full）。 */
function variantPreferenceFor(
  capacityState: CapacityAnalysis['capacityState'],
  energyLevel: EnergyLevel,
  priority: TaskPriority,
  hasMinimumVersion: boolean,
  policy: TaskSchedulingPolicy,
): TaskCostVariant[] {
  let preferred: readonly TaskCostVariant[];
  if (capacityState === 'exhausted_by_commitments') {
    preferred = policy.variantPreference.exhaustedByCommitments;
  } else if (capacityState === 'commitment_heavy') {
    preferred = policy.variantPreference.commitmentHeavy;
  } else {
    preferred = policy.variantPreference.availableByEnergy[energyLevel][priority];
  }
  return preferred.filter((variant) => variant === 'full' || hasMinimumVersion);
}

/** 安排原因码：minimum 的选择动机取决于容量状态与能量档位。 */
function placementReasonCodes(
  variant: TaskCostVariant,
  capacityState: CapacityAnalysis['capacityState'],
  energyLevel: EnergyLevel,
): SchedulePlacementReasonCode[] {
  if (variant === 'full') {
    return ['FULL_VERSION_SELECTED'];
  }
  if (capacityState === 'commitment_heavy') {
    return ['MINIMUM_SELECTED_COMMITMENT_HEAVY'];
  }
  if (energyLevel === 20) {
    return ['MINIMUM_SELECTED_LOW_ENERGY'];
  }
  // available 且能量 50/80 时的 minimum：无论是首选还是 full 放不下后的降级，
  // 都记为回退码（策略枚举中只有这四个安排原因码）。
  return ['MINIMUM_SELECTED_AS_FALLBACK'];
}

/**
 * 生成今日调度。
 *
 * 内部强制重新调用 analyzeDailyCapacity（不接受外部传入的容量，避免结果过期）。
 * 放置规则：从最早空闲槽位开始，任务必须完整落在单个剩余连续槽位内；
 * 任务结束不得晚于 deadlineAtMs；已安排总分钟不超过 schedulableMinutes、
 * 总能量不超过 remainingEnergyPoints；放置成功后推进该槽位游标。
 */
export function scheduleDailyPlan(
  input: DailyPlanningInput,
  policy: TaskSchedulingPolicy = TASK_SCHEDULING_POLICY_V1,
  energyPolicy: EnergyPolicy = ENERGY_POLICY_V1,
): DailySchedule {
  const capacity = analyzeDailyCapacity(input, energyPolicy);
  const energyLevel = input.checkIn.energyLevel;

  // 排序：不可变拷贝后稳定排序，保留原输入顺序作为最终平局裁决。
  const orderedTasks = input.tasks
    .map((task, originalIndex) => ({ task, originalIndex }))
    .sort((a, b) => compareTasks(a, b, policy));

  // 槽位游标：cursor[i] 为第 i 个空闲槽位的当前可用起点。
  const cursors = capacity.freeSlots.map((slot) => slot.startAtMs);
  let remainingMinutes = capacity.schedulableMinutes;
  let remainingEnergy = capacity.remainingEnergyPoints;

  const scheduledItems: ScheduledItem[] = [];
  const deferredItems: DeferredItem[] = [];

  for (const { task } of orderedTasks) {
    const variants = variantPreferenceFor(
      capacity.capacityState,
      energyLevel,
      task.priority,
      task.minimumVersion !== undefined,
      policy,
    );

    if (capacity.capacityState === 'exhausted_by_commitments') {
      deferredItems.push({
        taskId: task.id,
        priority: task.priority,
        attemptedVariants: [],
        reasonCodes: ['CAPACITY_EXHAUSTED'],
      });
      continue;
    }

    const attemptedVariants: TaskCostVariant[] = [];
    const blockingReasons: ScheduleDeferredReason[] = [];
    let placed = false;

    for (const variant of variants) {
      attemptedVariants.push(variant);
      const costResult = estimateTaskEnergyCost(task, variant, energyPolicy);
      if (!costResult.ok) {
        // minimum 缺失等结构性问题：跳过该形态，尝试下一形态。
        continue;
      }
      const cost = costResult.value;

      // 总预算检查：产生各自独立的原因码。
      if (cost.costPoints > remainingEnergy) {
        blockingReasons.push({
          code: 'INSUFFICIENT_ENERGY',
          message: `剩余能量 ${remainingEnergy} 点不足以承担 ${variant} 版本的 ${cost.costPoints} 点成本`,
          values: {
            requiredEnergyPoints: cost.costPoints,
            remainingEnergyPoints: remainingEnergy,
          },
        });
        continue;
      }
      if (cost.minutes > remainingMinutes) {
        blockingReasons.push({
          code: 'INSUFFICIENT_TOTAL_MINUTES',
          message: `剩余可安排时间 ${remainingMinutes} 分钟不足 ${variant} 版本所需的 ${cost.minutes} 分钟`,
          values: { requiredMinutes: cost.minutes, remainingSchedulableMinutes: remainingMinutes },
        });
        continue;
      }

      // 槽位查找：从最早槽位开始，放置在该槽位当前游标处（最早可行位置）。
      const neededMs = cost.minutes * MS_PER_MINUTE;
      let slotFitsSomewhere = false;
      let deadlineBlocked = false;
      let placedIndex = -1;
      for (let i = 0; i < capacity.freeSlots.length; i += 1) {
        const slot = capacity.freeSlots[i];
        const cursor = cursors[i];
        const endAtMs = cursor + neededMs;
        if (endAtMs <= slot.endAtMs) {
          slotFitsSomewhere = true;
          if (task.deadlineAtMs !== undefined && endAtMs > task.deadlineAtMs) {
            deadlineBlocked = true;
            continue;
          }
          placedIndex = i;
          break;
        }
      }
      if (placedIndex < 0) {
        if (deadlineBlocked) {
          blockingReasons.push({
            code: 'DEADLINE_CANNOT_BE_MET',
            message: `${variant} 版本无法在截止时间前完整完成`,
            values: {
              requiredMinutes: cost.minutes,
              ...(task.deadlineAtMs !== undefined ? { deadlineAtMs: task.deadlineAtMs } : {}),
            },
          });
        } else if (!slotFitsSomewhere) {
          blockingReasons.push({
            code: 'NO_CONTIGUOUS_SLOT',
            message: `没有任何剩余连续槽位容纳 ${variant} 版本所需的 ${cost.minutes} 分钟`,
            values: { requiredMinutes: cost.minutes },
          });
        }
        continue;
      }

      // 成功放置：推进游标、扣减预算。
      const startAtMs = cursors[placedIndex];
      cursors[placedIndex] = startAtMs + neededMs;
      remainingMinutes -= cost.minutes;
      remainingEnergy -= cost.costPoints;
      scheduledItems.push({
        taskId: task.id,
        title: variant === 'minimum' && task.minimumVersion !== undefined ? task.minimumVersion.title : task.title,
        priority: task.priority,
        variant,
        window: { startAtMs, endAtMs: startAtMs + neededMs },
        minutes: cost.minutes,
        energyCostPoints: cost.costPoints,
        reasonCodes: placementReasonCodes(variant, capacity.capacityState, energyLevel),
      });
      placed = true;
      break;
    }

    if (!placed) {
      // 去重保留首次出现顺序：同一原因码只报一次。
      const reasonCodes: ScheduleDeferredReasonCode[] = [];
      for (const blocking of blockingReasons) {
        if (!reasonCodes.includes(blocking.code)) {
          reasonCodes.push(blocking.code);
        }
      }
      deferredItems.push({
        taskId: task.id,
        priority: task.priority,
        attemptedVariants,
        reasonCodes,
      });
    }
  }

  return {
    policyVersion: policy.version,
    energyPolicyVersion: energyPolicy.version,
    capacity,
    scheduledItems,
    deferredItems,
    remainingSchedulableMinutes: remainingMinutes,
    remainingEnergyPoints: remainingEnergy,
    mustTaskDeferredIds: deferredItems
      .filter((item) => item.priority === 'must')
      .map((item) => item.taskId),
  };
}
