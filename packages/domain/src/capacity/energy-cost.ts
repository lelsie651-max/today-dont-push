/**
 * 能量成本计算。
 *
 * 全部为确定性整数/纯算术：分钟数使用完整分钟（低于一分钟的余数向下取整），
 * 成本按 policy.costBlockMinutes 结算块向上取整。不读取当前时间、不抛异常：
 * 预期错误（如请求不存在的 minimumVersion）通过 DomainResult 返回。
 */
import { error, fail, ok, type DomainResult } from '../shared.js';
import type { TimeWindow } from '../time.js';
import type { FixedCommitment } from '../fixed-commitment.js';
import type { FlexibleTask } from '../flexible-task.js';
import { ENERGY_POLICY_V1, type EnergyPolicy } from './energy-policy.js';

const MS_PER_MINUTE = 60_000;

/** 时间窗口的完整分钟数（低于一分钟的余数向下取整）。 */
export function durationInWholeMinutes(window: TimeWindow): number {
  return Math.floor((window.endAtMs - window.startAtMs) / MS_PER_MINUTE);
}

/**
 * 固定承诺能量成本：ceil(持续分钟数 / costBlockMinutes) × energyDemand。
 */
export function commitmentEnergyCostPoints(
  commitment: FixedCommitment,
  policy: EnergyPolicy = ENERGY_POLICY_V1,
): number {
  const minutes = durationInWholeMinutes(commitment.window);
  return Math.ceil(minutes / policy.costBlockMinutes) * commitment.energyDemand;
}

/** 任务成本评估形态：full 使用原任务，minimum 使用最低可行版本。 */
export type TaskCostVariant = 'full' | 'minimum';

/** 任务能量成本评估结果。 */
export interface TaskEnergyCost {
  readonly taskId: string;
  readonly variant: TaskCostVariant;
  /** 参与结算的分钟数（full 为原任务，minimum 为最低版本）。 */
  readonly minutes: number;
  /** 参与结算的能量需求。 */
  readonly energyDemand: number;
  /** 心理阻力一律取原任务的值（降级不改变心理阻力）。 */
  readonly emotionalResistance: number;
  readonly costPoints: number;
}

/**
 * 评估弹性任务能量成本。
 *
 * 公式：ceil(任务分钟数 / costBlockMinutes) × energyDemand + emotionalResistance × emotionalResistanceCostPoints。
 * minimum 形态使用 minimumVersion 的时间与 energyDemand，但保留原任务的 emotionalResistance；
 * 任务没有 minimumVersion 却请求 minimum 时，返回结构化错误，不 throw。
 */
export function estimateTaskEnergyCost(
  task: FlexibleTask,
  variant: TaskCostVariant = 'full',
  policy: EnergyPolicy = ENERGY_POLICY_V1,
): DomainResult<TaskEnergyCost> {
  if (variant === 'minimum' && task.minimumVersion === undefined) {
    return fail([
      error(
        'MINIMUM_VERSION_MISSING',
        'task.minimumVersion',
        `任务 ${task.id} 未提供 minimumVersion，无法评估 minimum 成本`,
      ),
    ]);
  }
  const source = variant === 'minimum' && task.minimumVersion !== undefined ? task.minimumVersion : task;
  const costPoints =
    Math.ceil(source.estimatedMinutes / policy.costBlockMinutes) * source.energyDemand +
    task.emotionalResistance * policy.emotionalResistanceCostPoints;
  return ok({
    taskId: task.id,
    variant,
    minutes: source.estimatedMinutes,
    energyDemand: source.energyDemand,
    emotionalResistance: task.emotionalResistance,
    costPoints,
  });
}
