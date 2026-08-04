/**
 * 固定承诺领域模型。
 *
 * 固定承诺是今天"必须在特定时间段发生"的事（如会议、通勤、预约），
 * 时间不可挪动，只能被尊重；与之相对的是弹性任务（见 flexible-task.ts）。
 */
import {
  ok,
  validateIntegerInRange,
  validateRequiredText,
  type DomainError,
  type DomainResult,
} from './shared.js';
import { createTimeWindow, type TimeWindow, type TimeWindowInput } from './time.js';

/** 能量消耗最小值。 */
export const MIN_ENERGY_DEMAND = 1;
/** 能量消耗最大值。 */
export const MAX_ENERGY_DEMAND = 5;
/** 标题最大长度（去空格后）。 */
export const MAX_TITLE_LENGTH = 100;

/** 固定承诺。 */
export interface FixedCommitment {
  readonly id: string;
  readonly title: string;
  readonly window: TimeWindow;
  /** 预计消耗的能量，1（轻松）至 5（透支）。 */
  readonly energyDemand: number;
}

/** FixedCommitment 工厂入参。 */
export interface FixedCommitmentInput {
  readonly id: string;
  readonly title: string;
  readonly window: TimeWindowInput;
  readonly energyDemand: number;
}

/**
 * 构造固定承诺。
 *
 * 不变量：
 * - id 去空格后非空；
 * - title 去空格后非空，且不超过 MAX_TITLE_LENGTH；
 * - window 为合法时间窗口；
 * - energyDemand 为 1 至 5 的整数。
 */
export function createFixedCommitment(
  input: FixedCommitmentInput,
  path = 'commitment',
): DomainResult<FixedCommitment> {
  const errors: DomainError[] = [];

  const id = validateRequiredText(errors, input.id, `${path}.id`, 'id', MAX_TITLE_LENGTH);
  const title = validateRequiredText(errors, input.title, `${path}.title`, '标题', MAX_TITLE_LENGTH);
  validateIntegerInRange(
    errors,
    input.energyDemand,
    `${path}.energyDemand`,
    'energyDemand',
    MIN_ENERGY_DEMAND,
    MAX_ENERGY_DEMAND,
  );

  const windowResult = createTimeWindow(input.window, `${path}.window`);
  if (!windowResult.ok) {
    errors.push(...windowResult.errors);
    return { ok: false, errors };
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return ok({ id, title, window: windowResult.value, energyDemand: input.energyDemand });
}
