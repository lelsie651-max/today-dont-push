/**
 * 容量分析（调度引擎第一阶段）目录桶导出。
 *
 * 本目录只做"可解释容量分析"：不选择任务、不安排任务时间、不决定延期。
 */
export type { EnergyPolicy, EnergyPolicyVersion } from './energy-policy.js';
export { ENERGY_POLICY_V1 } from './energy-policy.js';
export { deriveFreeSlots } from './free-slots.js';
export type { TaskCostVariant, TaskEnergyCost } from './energy-cost.js';
export {
  commitmentEnergyCostPoints,
  durationInWholeMinutes,
  estimateTaskEnergyCost,
} from './energy-cost.js';
export type { CapacityAnalysis, CapacityReason, CapacityReasonCode, CapacityState } from './analyzer.js';
export { analyzeDailyCapacity } from './analyzer.js';
