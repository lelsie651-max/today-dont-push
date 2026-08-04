/**
 * 能量策略 energy-policy-v1。
 *
 * 这是可调整的工程启发式规则（不是医疗判断，见 docs/product/energy-policy-v1.md）。
 * 所有策略常量集中定义在本文件，分析器与成本计算不得散落硬编码。
 */
import type { EnergyLevel, StrainTag } from '../check-in.js';

/** 策略版本号。 */
export type EnergyPolicyVersion = 'energy-policy-v1';

/** 能量策略：容量分析使用的全部可调参数。 */
export interface EnergyPolicy {
  readonly version: EnergyPolicyVersion;
  /** 基础能量点：直接使用 EnergyLevel 的三档数值。 */
  readonly baseEnergyPointsByLevel: Readonly<Record<EnergyLevel, number>>;
  /** 每个负担标签扣减的能量点。 */
  readonly strainPenaltyByTag: Readonly<Record<StrainTag, number>>;
  /** strain 总扣减上限（点）。 */
  readonly maxStrainPenaltyPoints: number;
  /** 保护性空白比例（百分比整数）：按能量档位区分。 */
  readonly protectedBufferPercentByEnergy: Readonly<Record<EnergyLevel, number>>;
  /** 保护性空白向上取整的粒度（分钟）。 */
  readonly protectedBufferRoundUpMinutes: number;
  /** 承诺与任务能量成本的结算块长度（分钟）。 */
  readonly costBlockMinutes: number;
  /** 每一点 emotionalResistance 附加的能量成本（点）。 */
  readonly emotionalResistanceCostPoints: number;
}

/** 当前唯一启用的策略版本。 */
export const ENERGY_POLICY_V1: EnergyPolicy = {
  version: 'energy-policy-v1',
  baseEnergyPointsByLevel: { 20: 20, 50: 50, 80: 80 },
  strainPenaltyByTag: {
    poor_sleep: 6,
    physical_discomfort: 8,
    low_mood: 5,
    exhausting_commute: 4,
    meeting_heavy: 4,
    urgent_deadline: 3,
    interpersonal_stress: 5,
    other: 3,
  },
  maxStrainPenaltyPoints: 15,
  protectedBufferPercentByEnergy: { 20: 30, 50: 20, 80: 10 },
  protectedBufferRoundUpMinutes: 5,
  costBlockMinutes: 30,
  emotionalResistanceCostPoints: 2,
};
