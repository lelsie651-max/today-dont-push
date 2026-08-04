/**
 * 可解释容量分析器（调度引擎第一阶段）。
 *
 * 只回答"今天还剩多少时间与能量"，不选择任务、不安排时间、不决定延期。
 * 纯函数：相同输入必然返回完全相同的结果；不读取当前时间、不使用随机数，
 * 比例计算一律使用整数百分比算术，避免浮点不稳定行为。
 */
import type { TimeWindow } from '../time.js';
import type { DailyPlanningInput } from '../planning.js';
import { ENERGY_POLICY_V1, type EnergyPolicy } from './energy-policy.js';
import { deriveFreeSlots } from './free-slots.js';
import { commitmentEnergyCostPoints, durationInWholeMinutes } from './energy-cost.js';

/** 容量状态。 */
export type CapacityState = 'exhausted_by_commitments' | 'commitment_heavy' | 'available';

/** 容量原因码：机器可读，UI/审计可据此重算与展示。 */
export type CapacityReasonCode =
  | 'NO_FIXED_COMMITMENTS'
  | 'STRAIN_PENALTY_APPLIED'
  | 'PROTECTED_BUFFER_RESERVED'
  | 'EXHAUSTED_BY_COMMITMENT_ENERGY'
  | 'EXHAUSTED_NO_SCHEDULABLE_TIME'
  | 'COMMITMENT_ENERGY_SHARE_HIGH'
  | 'COMMITMENT_TIME_SHARE_HIGH'
  | 'CAPACITY_AVAILABLE';

/** 结构化原因：不只返回展示文案，附带相关数值。 */
export interface CapacityReason {
  readonly code: CapacityReasonCode;
  readonly message: string;
  readonly values: Readonly<Record<string, number>>;
}

/** 每日容量分析结果。 */
export interface CapacityAnalysis {
  readonly policyVersion: EnergyPolicy['version'];
  readonly totalPlanningMinutes: number;
  readonly fixedCommitmentMinutes: number;
  readonly freeMinutes: number;
  readonly protectedBufferMinutes: number;
  readonly schedulableMinutes: number;
  readonly baseEnergyPoints: number;
  readonly strainPenaltyPoints: number;
  readonly adjustedEnergyPoints: number;
  readonly commitmentEnergyCostPoints: number;
  readonly remainingEnergyPoints: number;
  readonly freeSlots: readonly TimeWindow[];
  readonly capacityState: CapacityState;
  readonly reasons: readonly CapacityReason[];
}

function reason(
  code: CapacityReasonCode,
  message: string,
  values: Readonly<Record<string, number>>,
): CapacityReason {
  return { code, message, values };
}

/**
 * 分析今日容量。
 *
 * 时间与能量账本：
 * - 空闲槽位 = planningWindows − commitments；
 * - protectedBufferMinutes = freeMinutes × 档位比例，向上取整到 5 分钟，且不超过 freeMinutes；
 * - schedulableMinutes = freeMinutes − protectedBufferMinutes；
 * - adjustedEnergyPoints = max(0, 基础能量点 − min(strain 扣减, 上限))；
 * - remainingEnergyPoints = max(0, adjustedEnergyPoints − 承诺能量成本)。
 */
export function analyzeDailyCapacity(
  input: DailyPlanningInput,
  policy: EnergyPolicy = ENERGY_POLICY_V1,
): CapacityAnalysis {
  // ---- 时间账本 ----
  const totalPlanningMinutes = input.planningWindows.reduce(
    (sum, window) => sum + durationInWholeMinutes(window),
    0,
  );
  const fixedCommitmentMinutes = input.commitments.reduce(
    (sum, commitment) => sum + durationInWholeMinutes(commitment.window),
    0,
  );
  const freeSlots = deriveFreeSlots(input.planningWindows, input.commitments);
  const freeMinutes = freeSlots.reduce((sum, slot) => sum + durationInWholeMinutes(slot), 0);

  // 保护性空白：整数百分比算术（freeMinutes × percent / 100），向上取整到结算粒度，且不超过空闲时间。
  const protectedBufferPercent = policy.protectedBufferPercentByEnergy[input.checkIn.energyLevel];
  const roundUp = policy.protectedBufferRoundUpMinutes;
  const rawBufferPercentMinutes = freeMinutes * protectedBufferPercent;
  const protectedBufferMinutes = Math.min(
    Math.ceil(rawBufferPercentMinutes / (100 * roundUp)) * roundUp,
    freeMinutes,
  );
  const schedulableMinutes = freeMinutes - protectedBufferMinutes;

  // ---- 能量账本 ----
  const baseEnergyPoints = policy.baseEnergyPointsByLevel[input.checkIn.energyLevel];
  const rawStrainPenaltyPoints = input.checkIn.strainTags.reduce(
    (sum, tag) => sum + policy.strainPenaltyByTag[tag],
    0,
  );
  const strainPenaltyPoints = Math.min(rawStrainPenaltyPoints, policy.maxStrainPenaltyPoints);
  const adjustedEnergyPoints = Math.max(0, baseEnergyPoints - strainPenaltyPoints);
  const commitmentEnergyCost = input.commitments.reduce(
    (sum, commitment) => sum + commitmentEnergyCostPoints(commitment, policy),
    0,
  );
  const remainingEnergyPoints = Math.max(0, adjustedEnergyPoints - commitmentEnergyCost);

  // ---- 容量状态判定（整数比较，避免浮点） ----
  const exhaustedByEnergy = commitmentEnergyCost >= adjustedEnergyPoints;
  const exhaustedByTime = schedulableMinutes === 0;
  const energyShareHeavy =
    !exhaustedByEnergy &&
    adjustedEnergyPoints > 0 &&
    commitmentEnergyCost * 2 >= adjustedEnergyPoints;
  const timeShareHeavy = fixedCommitmentMinutes * 2 >= totalPlanningMinutes;

  let capacityState: CapacityState;
  if (exhaustedByEnergy || exhaustedByTime) {
    capacityState = 'exhausted_by_commitments';
  } else if (energyShareHeavy || timeShareHeavy) {
    capacityState = 'commitment_heavy';
  } else {
    capacityState = 'available';
  }

  // ---- 结构化原因 ----
  const reasons: CapacityReason[] = [];
  if (input.commitments.length === 0) {
    reasons.push(
      reason('NO_FIXED_COMMITMENTS', '今天没有固定承诺，全部可规划时间都计入空闲槽位', {}),
    );
  }
  if (rawStrainPenaltyPoints > 0) {
    reasons.push(
      reason(
        'STRAIN_PENALTY_APPLIED',
        `负担标签共扣减 ${strainPenaltyPoints} 点能量${rawStrainPenaltyPoints > strainPenaltyPoints ? `（原始 ${rawStrainPenaltyPoints} 点已按上限截断）` : ''}`,
        {
          rawStrainPenaltyPoints,
          strainPenaltyPoints,
          maxStrainPenaltyPoints: policy.maxStrainPenaltyPoints,
        },
      ),
    );
  }
  if (freeMinutes > 0) {
    reasons.push(
      reason(
        'PROTECTED_BUFFER_RESERVED',
        `为恢复预留了 ${protectedBufferMinutes} 分钟保护性空白（空闲时间的 ${protectedBufferPercent}%）`,
        {
          protectedBufferMinutes,
          protectedBufferPercent,
          freeMinutes,
        },
      ),
    );
  }
  if (exhaustedByEnergy) {
    reasons.push(
      reason(
        'EXHAUSTED_BY_COMMITMENT_ENERGY',
        `固定承诺的能量成本（${commitmentEnergyCost} 点）已达到或超过今日调整后能量（${adjustedEnergyPoints} 点）`,
        { commitmentEnergyCostPoints: commitmentEnergyCost, adjustedEnergyPoints },
      ),
    );
  }
  if (exhaustedByTime) {
    reasons.push(
      reason(
        'EXHAUSTED_NO_SCHEDULABLE_TIME',
        '扣除固定承诺与保护性空白后，今天没有可安排任务的时间',
        { schedulableMinutes, freeMinutes, protectedBufferMinutes },
      ),
    );
  }
  if (energyShareHeavy) {
    reasons.push(
      reason(
        'COMMITMENT_ENERGY_SHARE_HIGH',
        `固定承诺消耗了今日至少一半的调整后能量（${commitmentEnergyCost} / ${adjustedEnergyPoints} 点）`,
        { commitmentEnergyCostPoints: commitmentEnergyCost, adjustedEnergyPoints },
      ),
    );
  }
  if (timeShareHeavy) {
    reasons.push(
      reason(
        'COMMITMENT_TIME_SHARE_HIGH',
        `固定承诺占用了今日至少一半的可规划时间（${fixedCommitmentMinutes} / ${totalPlanningMinutes} 分钟）`,
        { fixedCommitmentMinutes, totalPlanningMinutes },
      ),
    );
  }
  if (capacityState === 'available') {
    reasons.push(
      reason(
        'CAPACITY_AVAILABLE',
        `今天还有 ${schedulableMinutes} 分钟与 ${remainingEnergyPoints} 点能量可用于弹性任务`,
        { remainingEnergyPoints, schedulableMinutes },
      ),
    );
  }

  return {
    policyVersion: policy.version,
    totalPlanningMinutes,
    fixedCommitmentMinutes,
    freeMinutes,
    protectedBufferMinutes,
    schedulableMinutes,
    baseEnergyPoints,
    strainPenaltyPoints,
    adjustedEnergyPoints,
    commitmentEnergyCostPoints: commitmentEnergyCost,
    remainingEnergyPoints,
    freeSlots,
    capacityState,
    reasons,
  };
}
