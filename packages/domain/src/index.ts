/**
 * 领域层公共 API。
 *
 * 本包是领域模型与业务规则的唯一归属地：只读、可序列化的普通对象 +
 * 返回 DomainResult 的工厂函数。不依赖任何第三方库、不读取当前时间、
 * 不生成随机 ID、不接触数据库。
 *
 * 依赖约束：本包不得依赖任何内部包、框架或第三方库
 * （见 docs/architecture/overview.md）。
 * 术语与数值范围说明见 docs/product/core-domain.md。
 */

/** 包标识（保留：application 占位代码依赖此导出）。 */
export const DOMAIN_PACKAGE_NAME = '@today-dont-push/domain' as const;

// 通用领域结果
export type { DomainError, DomainResult } from './shared.js';
export { error, fail, ok, trimText } from './shared.js';

// 今日状态（每日签到）
export type { DailyCheckIn, DailyCheckInInput, EnergyLevel, StrainTag } from './check-in.js';
export { ENERGY_LEVELS, MAX_NOTE_LENGTH, STRAIN_TAGS, createDailyCheckIn } from './check-in.js';

// 时间范围
export type { TimeWindow, TimeWindowInput } from './time.js';
export { createTimeWindow, windowsOverlap, windowWithin } from './time.js';

// 固定承诺
export type { FixedCommitment, FixedCommitmentInput } from './fixed-commitment.js';
export {
  MAX_ENERGY_DEMAND as COMMITMENT_MAX_ENERGY_DEMAND,
  MIN_ENERGY_DEMAND as COMMITMENT_MIN_ENERGY_DEMAND,
  MAX_TITLE_LENGTH as COMMITMENT_MAX_TITLE_LENGTH,
  createFixedCommitment,
} from './fixed-commitment.js';

// 弹性任务与最低可行版本
export type {
  FlexibleTask,
  FlexibleTaskInput,
  MinimumViableVersion,
  MinimumViableVersionInput,
  TaskPriority,
} from './flexible-task.js';
export {
  MAX_EMOTIONAL_RESISTANCE,
  MAX_ENERGY_DEMAND as TASK_MAX_ENERGY_DEMAND,
  MAX_ESTIMATED_MINUTES,
  MAX_TITLE_LENGTH as TASK_MAX_TITLE_LENGTH,
  MIN_EMOTIONAL_RESISTANCE,
  MIN_ENERGY_DEMAND as TASK_MIN_ENERGY_DEMAND,
  MIN_ESTIMATED_MINUTES,
  TASK_PRIORITIES,
  createFlexibleTask,
} from './flexible-task.js';

// 每日规划输入
export type { DailyPlanningInput, DailyPlanningInputInput } from './planning.js';
export {
  MAX_LOCAL_DATE_LENGTH,
  MAX_TIME_ZONE_LENGTH,
  createDailyPlanningInput,
} from './planning.js';

// 容量分析（调度引擎第一阶段：只分析容量，不选择/安排任务）
export type {
  CapacityAnalysis,
  CapacityReason,
  CapacityReasonCode,
  CapacityState,
  EnergyPolicy,
  EnergyPolicyVersion,
  TaskCostVariant,
  TaskEnergyCost,
} from './capacity/index.js';
export {
  ENERGY_POLICY_V1,
  analyzeDailyCapacity,
  commitmentEnergyCostPoints,
  deriveFreeSlots,
  durationInWholeMinutes,
  estimateTaskEnergyCost,
} from './capacity/index.js';

// 任务决策与时段放置（调度引擎第二阶段：确定性调度，不拆分任务）
export type {
  DailySchedule,
  DeferredItem,
  ScheduleDeferredReason,
  ScheduleDeferredReasonCode,
  SchedulePlacementReasonCode,
  ScheduledItem,
  TaskSchedulingPolicy,
  TaskSchedulingPolicyVersion,
  VariantPreferenceByPriority,
} from './capacity/index.js';
export { TASK_SCHEDULING_POLICY_V1, scheduleDailyPlan } from './capacity/index.js';
