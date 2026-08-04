/**
 * 确定性任务决策与时段放置（调度器 V1 核心语义）。
 *
 * 在容量分析（第一阶段）之上决定：哪些任务今天做、用哪个版本（full / minimum）、
 * 放在哪个空闲槽位。纯函数：相同输入必然返回完全相同的结果；不读取当前时间、
 * 不使用随机数；不修改输入对象；不拆分任务、不允许任务跨槽位执行。
 *
 * must 任务采用两阶段决策：先为每个 must 安排"最低可行基线"（有 minimum 则
 * minimum，否则 full），尽可能保证每个 must 都拿到最低完成机会；再按 must 顺序
 * 尝试把策略偏好 full 的 must 从 minimum 升级为 full——任何升级都从头重新模拟
 * must 计划，只有基线阶段原本能安排的 must 集合仍全部能安排时才接受升级，
 * 不允许为了一个 must 的 full 牺牲另一个原本可完成的 must 基线。
 * 之后用最终 must 计划的剩余槽位、分钟与能量按原规则安排 important / optional。
 *
 * 规则说明见 docs/product/task-scheduling-policy-v1.md。
 */
import type { TimeWindow } from '../time.js';
import type { DailyPlanningInput } from '../planning.js';
import type { EnergyLevel } from '../check-in.js';
import type { FlexibleTask, TaskPriority } from '../flexible-task.js';
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
  | 'MINIMUM_SELECTED_BALANCED_ENERGY'
  | 'MINIMUM_SELECTED_TO_PROTECT_MUST_COVERAGE'
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
  /** 调度决策顺序，从 0 开始（must 计划在前，随后 important / optional）。 */
  readonly decisionRank: number;
}

/** 被延期的任务。 */
export interface DeferredItem {
  readonly taskId: string;
  readonly priority: TaskPriority;
  readonly attemptedVariants: readonly TaskCostVariant[];
  /** 结构化延期原因（含文案与数值），reasonCodes 由它去重派生。 */
  readonly reasons: readonly ScheduleDeferredReason[];
  readonly reasonCodes: readonly ScheduleDeferredReasonCode[];
}

/** 每日调度结果。 */
export interface DailySchedule {
  readonly policyVersion: TaskSchedulingPolicyVersion;
  readonly energyPolicyVersion: EnergyPolicyVersion;
  readonly capacity: CapacityAnalysis;
  /** 已按 startAtMs → endAtMs → decisionRank 排序，可直接展示时间线。 */
  readonly scheduledItems: readonly ScheduledItem[];
  readonly deferredItems: readonly DeferredItem[];
  readonly remainingSchedulableMinutes: number;
  readonly remainingEnergyPoints: number;
  /** 被延期的 must 任务 id——产品需要专门对它们说话。 */
  readonly mustTaskDeferredIds: readonly string[];
}

/** 排序后的任务：originalIndex 是稳定排序的最终平局裁决。 */
interface OrderedTask {
  readonly task: FlexibleTask;
  readonly originalIndex: number;
}

/** 槽位游标与双预算的工作状态（仅在单次模拟内部可变，绝不触碰输入）。 */
interface PlacementState {
  readonly cursors: number[];
  remainingMinutes: number;
  remainingEnergy: number;
}

/** 一次成功放置的位置信息。 */
interface PlacementSpot {
  readonly slotIndex: number;
  readonly startAtMs: number;
  readonly endAtMs: number;
  readonly minutes: number;
  readonly costPoints: number;
}

/** must 计划模拟结果：已放置项、延期原因与用尽后的状态。 */
interface MustPlanResult {
  readonly placements: ReadonlyMap<string, { variant: TaskCostVariant; spot: PlacementSpot }>;
  readonly deferrals: ReadonlyMap<string, readonly ScheduleDeferredReason[]>;
  readonly state: PlacementState;
}

/** must 升级被拒绝的动机：full 自身放不下，或会牺牲其他 must 的基线。 */
type MustUpgradeRejection = 'full_failed' | 'protect_coverage';

/** 稳定排序键：priority 权重 → 有 deadline 优先 → deadline 越早越优先 → 原输入顺序。 */
function compareTasks(a: OrderedTask, b: OrderedTask, policy: TaskSchedulingPolicy): number {
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

/** 策略对该任务的第一偏好是否为 full（决定 must 是否进入升级阶段）。 */
function policyPrefersFull(
  capacityState: CapacityAnalysis['capacityState'],
  energyLevel: EnergyLevel,
  priority: TaskPriority,
  policy: TaskSchedulingPolicy,
): boolean {
  if (capacityState === 'exhausted_by_commitments') {
    return false;
  }
  const preferred =
    capacityState === 'commitment_heavy'
      ? policy.variantPreference.commitmentHeavy
      : policy.variantPreference.availableByEnergy[energyLevel][priority];
  return preferred[0] === 'full';
}

function cloneState(state: PlacementState): PlacementState {
  return {
    cursors: [...state.cursors],
    remainingMinutes: state.remainingMinutes,
    remainingEnergy: state.remainingEnergy,
  };
}

/**
 * 尝试把单个任务以指定形态放进当前状态：返回放置位置或结构化阻塞原因。
 * 纯检查，不修改状态；成本无法评估（结构性问题）时返回空原因，由调用方跳过。
 */
function attemptPlacement(
  task: FlexibleTask,
  variant: TaskCostVariant,
  state: PlacementState,
  capacity: CapacityAnalysis,
  energyPolicy: EnergyPolicy,
): { placed: PlacementSpot | undefined; reasons: ScheduleDeferredReason[] } {
  const costResult = estimateTaskEnergyCost(task, variant, energyPolicy);
  if (!costResult.ok) {
    return { placed: undefined, reasons: [] };
  }
  const cost = costResult.value;

  // 总预算检查：产生各自独立的原因码。
  if (cost.costPoints > state.remainingEnergy) {
    return {
      placed: undefined,
      reasons: [
        {
          code: 'INSUFFICIENT_ENERGY',
          message: `剩余能量 ${state.remainingEnergy} 点不足以承担 ${variant} 版本的 ${cost.costPoints} 点成本`,
          values: {
            requiredEnergyPoints: cost.costPoints,
            remainingEnergyPoints: state.remainingEnergy,
          },
        },
      ],
    };
  }
  if (cost.minutes > state.remainingMinutes) {
    return {
      placed: undefined,
      reasons: [
        {
          code: 'INSUFFICIENT_TOTAL_MINUTES',
          message: `剩余可安排时间 ${state.remainingMinutes} 分钟不足 ${variant} 版本所需的 ${cost.minutes} 分钟`,
          values: {
            requiredMinutes: cost.minutes,
            remainingSchedulableMinutes: state.remainingMinutes,
          },
        },
      ],
    };
  }

  // 槽位查找：从最早槽位开始，放置在该槽位当前游标处（最早可行位置）。
  const neededMs = cost.minutes * MS_PER_MINUTE;
  let deadlineBlocked = false;
  for (let i = 0; i < capacity.freeSlots.length; i += 1) {
    const slot = capacity.freeSlots[i];
    const cursor = state.cursors[i] ?? slot.startAtMs;
    const endAtMs = cursor + neededMs;
    if (endAtMs <= slot.endAtMs) {
      if (task.deadlineAtMs !== undefined && endAtMs > task.deadlineAtMs) {
        deadlineBlocked = true;
        continue;
      }
      return {
        placed: {
          slotIndex: i,
          startAtMs: cursor,
          endAtMs,
          minutes: cost.minutes,
          costPoints: cost.costPoints,
        },
        reasons: [],
      };
    }
  }
  if (deadlineBlocked) {
    return {
      placed: undefined,
      reasons: [
        {
          code: 'DEADLINE_CANNOT_BE_MET',
          message: `${variant} 版本无法在截止时间前完整完成`,
          values: {
            requiredMinutes: cost.minutes,
            ...(task.deadlineAtMs !== undefined ? { deadlineAtMs: task.deadlineAtMs } : {}),
          },
        },
      ],
    };
  }
  return {
    placed: undefined,
    reasons: [
      {
        code: 'NO_CONTIGUOUS_SLOT',
        message: `没有任何剩余连续槽位容纳 ${variant} 版本所需的 ${cost.minutes} 分钟`,
        values: { requiredMinutes: cost.minutes },
      },
    ],
  };
}

/** 成功放置：推进游标、扣减预算。 */
function commitPlacement(state: PlacementState, spot: PlacementSpot): void {
  state.cursors[spot.slotIndex] = spot.endAtMs;
  state.remainingMinutes -= spot.minutes;
  state.remainingEnergy -= spot.costPoints;
}

/**
 * must 计划模拟：按 must 顺序为每个 must 放置给定形态（不做形态回退）。
 * 某个 must 放不下时记录原因并继续尝试后续 must，不得直接终止。
 * 每次调用都从 fromState 的拷贝开始，保证"从头模拟"且互不污染。
 */
function simulateMustPlan(
  musts: readonly OrderedTask[],
  variants: ReadonlyMap<string, TaskCostVariant>,
  fromState: PlacementState,
  capacity: CapacityAnalysis,
  energyPolicy: EnergyPolicy,
): MustPlanResult {
  const state = cloneState(fromState);
  const placements = new Map<string, { variant: TaskCostVariant; spot: PlacementSpot }>();
  const deferrals = new Map<string, ScheduleDeferredReason[]>();
  for (const { task } of musts) {
    const variant = variants.get(task.id) ?? 'full';
    const attempt = attemptPlacement(task, variant, state, capacity, energyPolicy);
    if (attempt.placed !== undefined) {
      commitPlacement(state, attempt.placed);
      placements.set(task.id, { variant, spot: attempt.placed });
    } else {
      deferrals.set(task.id, attempt.reasons);
    }
  }
  return { placements, deferrals, state };
}

/**
 * 安排原因码：minimum 的选择动机取决于容量状态、能量档位与决策上下文。
 * - commitment_heavy / 能量 20 优先于一切（既有语义）；
 * - must 升级被拒：为保护其他 must 基线 → PROTECT_MUST_COVERAGE，full 自身失败 → FALLBACK；
 * - 策略本就首选 minimum → BALANCED_ENERGY；
 * - 其余（full 真实尝试失败后降级）→ FALLBACK。
 */
function placementReasonCode(
  variant: TaskCostVariant,
  capacityState: CapacityAnalysis['capacityState'],
  energyLevel: EnergyLevel,
  minimumWasFirstChoice: boolean,
  mustUpgradeRejection: MustUpgradeRejection | undefined,
): SchedulePlacementReasonCode {
  if (variant === 'full') {
    return 'FULL_VERSION_SELECTED';
  }
  if (capacityState === 'commitment_heavy') {
    return 'MINIMUM_SELECTED_COMMITMENT_HEAVY';
  }
  if (energyLevel === 20) {
    return 'MINIMUM_SELECTED_LOW_ENERGY';
  }
  if (mustUpgradeRejection === 'protect_coverage') {
    return 'MINIMUM_SELECTED_TO_PROTECT_MUST_COVERAGE';
  }
  if (mustUpgradeRejection === 'full_failed') {
    return 'MINIMUM_SELECTED_AS_FALLBACK';
  }
  if (minimumWasFirstChoice) {
    return 'MINIMUM_SELECTED_BALANCED_ENERGY';
  }
  return 'MINIMUM_SELECTED_AS_FALLBACK';
}

/** reasonCodes 一律从 reasons 去重派生（保留首次出现顺序），不独立维护。 */
function deriveReasonCodes(
  reasons: readonly ScheduleDeferredReason[],
): ScheduleDeferredReasonCode[] {
  const codes: ScheduleDeferredReasonCode[] = [];
  for (const reason of reasons) {
    if (!codes.includes(reason.code)) {
      codes.push(reason.code);
    }
  }
  return codes;
}

function buildScheduledItem(
  task: FlexibleTask,
  variant: TaskCostVariant,
  spot: PlacementSpot,
  decisionRank: number,
  reasonCode: SchedulePlacementReasonCode,
): ScheduledItem {
  return {
    taskId: task.id,
    // minimum 形态使用最低可行版本的标题。
    title:
      variant === 'minimum' && task.minimumVersion !== undefined
        ? task.minimumVersion.title
        : task.title,
    priority: task.priority,
    variant,
    window: { startAtMs: spot.startAtMs, endAtMs: spot.endAtMs },
    minutes: spot.minutes,
    energyCostPoints: spot.costPoints,
    reasonCodes: [reasonCode],
    decisionRank,
  };
}

/**
 * 生成今日调度。
 *
 * 内部强制重新调用 analyzeDailyCapacity（不接受外部传入的容量，避免结果过期）。
 * 放置规则：从最早空闲槽位开始，任务必须完整落在单个剩余连续槽位内；
 * 任务结束不得晚于 deadlineAtMs；已安排总分钟不超过 schedulableMinutes、
 * 总能量不超过 remainingEnergyPoints；放置成功后推进该槽位游标。
 *
 * must 两阶段：基线阶段为每个 must 安排最低可行版本（失败不终止），
 * 升级阶段仅当策略偏好 full 时尝试 minimum → full，且任何升级不得让
 * 基线阶段原本能安排的 must 失去位置。随后 important / optional 使用
 * 最终 must 计划的剩余资源按原规则安排。
 */
export function scheduleDailyPlan(
  input: DailyPlanningInput,
  policy: TaskSchedulingPolicy = TASK_SCHEDULING_POLICY_V1,
  energyPolicy: EnergyPolicy = ENERGY_POLICY_V1,
): DailySchedule {
  const capacity = analyzeDailyCapacity(input, energyPolicy);
  const energyLevel = input.checkIn.energyLevel;

  // 排序：不可变拷贝后稳定排序，保留原输入顺序作为最终平局裁决。
  const orderedTasks: OrderedTask[] = input.tasks
    .map((task, originalIndex) => ({ task, originalIndex }))
    .sort((a, b) => compareTasks(a, b, policy));

  const scheduledItems: ScheduledItem[] = [];
  const deferredItems: DeferredItem[] = [];
  const mustTaskDeferredIds: string[] = [];

  // exhausted：全部延期，结构化原因携带相关容量数值。
  if (capacity.capacityState === 'exhausted_by_commitments') {
    const exhaustedReason: ScheduleDeferredReason = {
      code: 'CAPACITY_EXHAUSTED',
      // 不假定存在固定承诺：耗尽可能来自承诺能量、也可能来自保护性空白占满后无可安排时间。
      message: '今日可安排容量已耗尽，不安排任何任务',
      values: {
        commitmentEnergyCostPoints: capacity.commitmentEnergyCostPoints,
        adjustedEnergyPoints: capacity.adjustedEnergyPoints,
        remainingEnergyPoints: capacity.remainingEnergyPoints,
        schedulableMinutes: capacity.schedulableMinutes,
        protectedBufferMinutes: capacity.protectedBufferMinutes,
      },
    };
    for (const { task } of orderedTasks) {
      deferredItems.push({
        taskId: task.id,
        priority: task.priority,
        attemptedVariants: [],
        reasons: [exhaustedReason],
        reasonCodes: deriveReasonCodes([exhaustedReason]),
      });
      if (task.priority === 'must') {
        mustTaskDeferredIds.push(task.id);
      }
    }
    return {
      policyVersion: policy.version,
      energyPolicyVersion: energyPolicy.version,
      capacity,
      scheduledItems,
      deferredItems,
      remainingSchedulableMinutes: capacity.schedulableMinutes,
      remainingEnergyPoints: capacity.remainingEnergyPoints,
      mustTaskDeferredIds,
    };
  }

  const musts = orderedTasks.filter((ordered) => ordered.task.priority === 'must');
  const rest = orderedTasks.filter((ordered) => ordered.task.priority !== 'must');

  const initialState: PlacementState = {
    cursors: capacity.freeSlots.map((slot) => slot.startAtMs),
    remainingMinutes: capacity.schedulableMinutes,
    remainingEnergy: capacity.remainingEnergyPoints,
  };

  // ---- must 基线阶段：有 minimum 则 minimum，否则 full；失败继续后续 must。 ----
  const baselineVariants = new Map<string, TaskCostVariant>();
  for (const { task } of musts) {
    baselineVariants.set(task.id, task.minimumVersion !== undefined ? 'minimum' : 'full');
  }
  const baseline = simulateMustPlan(musts, baselineVariants, initialState, capacity, energyPolicy);

  // ---- must 升级阶段：仅策略偏好 full 且基线为 minimum 的 must 参与。 ----
  const chosenVariants = new Map(baselineVariants);
  const upgradeRejections = new Map<string, MustUpgradeRejection>();
  for (const { task } of musts) {
    if (chosenVariants.get(task.id) !== 'minimum') {
      continue;
    }
    if (!baseline.placements.has(task.id)) {
      continue;
    }
    if (!policyPrefersFull(capacity.capacityState, energyLevel, task.priority, policy)) {
      continue;
    }
    const trial = new Map(chosenVariants);
    trial.set(task.id, 'full');
    // 每次升级从头模拟 must 计划；只有基线覆盖集合不缩小才接受升级。
    const simulated = simulateMustPlan(musts, trial, initialState, capacity, energyPolicy);
    const baselineStillCovered = [...baseline.placements.keys()].every((id) =>
      simulated.placements.has(id),
    );
    if (baselineStillCovered) {
      chosenVariants.set(task.id, 'full');
    } else {
      // full 自身都没能放下 → 真实尝试失败；放下了但挤掉其他 must → 保护覆盖率。
      upgradeRejections.set(
        task.id,
        simulated.placements.has(task.id) ? 'protect_coverage' : 'full_failed',
      );
    }
  }

  const finalMustPlan = simulateMustPlan(musts, chosenVariants, initialState, capacity, energyPolicy);

  // ---- must 决策输出（决策顺序：must 顺序在前）。 ----
  let decisionRank = 0;
  for (const { task } of musts) {
    const placement = finalMustPlan.placements.get(task.id);
    if (placement !== undefined) {
      const reasonCode = placementReasonCode(
        placement.variant,
        capacity.capacityState,
        energyLevel,
        !policyPrefersFull(capacity.capacityState, energyLevel, task.priority, policy),
        upgradeRejections.get(task.id),
      );
      scheduledItems.push(
        buildScheduledItem(task, placement.variant, placement.spot, decisionRank, reasonCode),
      );
      decisionRank += 1;
      continue;
    }
    const reasons = [...(finalMustPlan.deferrals.get(task.id) ?? [])];
    deferredItems.push({
      taskId: task.id,
      priority: task.priority,
      attemptedVariants: [chosenVariants.get(task.id) ?? 'full'],
      reasons,
      reasonCodes: deriveReasonCodes(reasons),
    });
    mustTaskDeferredIds.push(task.id);
  }

  // ---- important / optional：使用最终 must 计划的剩余槽位、分钟与能量。 ----
  const state = finalMustPlan.state;
  for (const { task } of rest) {
    const preference = variantPreferenceFor(
      capacity.capacityState,
      energyLevel,
      task.priority,
      task.minimumVersion !== undefined,
      policy,
    );
    const attemptedVariants: TaskCostVariant[] = [];
    const reasons: ScheduleDeferredReason[] = [];
    let placed = false;
    for (const variant of preference) {
      attemptedVariants.push(variant);
      const attempt = attemptPlacement(task, variant, state, capacity, energyPolicy);
      if (attempt.placed === undefined) {
        reasons.push(...attempt.reasons);
        continue;
      }
      commitPlacement(state, attempt.placed);
      const reasonCode = placementReasonCode(
        variant,
        capacity.capacityState,
        energyLevel,
        preference[0] === 'minimum',
        undefined,
      );
      scheduledItems.push(
        buildScheduledItem(task, variant, attempt.placed, decisionRank, reasonCode),
      );
      decisionRank += 1;
      placed = true;
      break;
    }
    if (!placed) {
      deferredItems.push({
        taskId: task.id,
        priority: task.priority,
        attemptedVariants,
        reasons,
        reasonCodes: deriveReasonCodes(reasons),
      });
    }
  }

  // 时间线排序：startAtMs → endAtMs → decisionRank（决策顺序保留在 decisionRank 中）。
  scheduledItems.sort(
    (a, b) =>
      a.window.startAtMs - b.window.startAtMs ||
      a.window.endAtMs - b.window.endAtMs ||
      a.decisionRank - b.decisionRank,
  );

  return {
    policyVersion: policy.version,
    energyPolicyVersion: energyPolicy.version,
    capacity,
    scheduledItems,
    deferredItems,
    remainingSchedulableMinutes: state.remainingMinutes,
    remainingEnergyPoints: state.remainingEnergy,
    mustTaskDeferredIds,
  };
}
