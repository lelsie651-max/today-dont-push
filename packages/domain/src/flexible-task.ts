/**
 * 弹性任务与最低可行版本领域模型。
 *
 * 弹性任务是"今天尽量做、但时间和形态可协商"的事。
 * 每个任务可以附带一个"最低可行版本"（minimumVersion）：
 * 状态很差时，用更小的代价拿到这件事的核心价值，而不是硬撑完整版。
 */
import {
  error,
  ok,
  validateIntegerInRange,
  validateRequiredText,
  type DomainError,
  type DomainResult,
} from './shared.js';

/** 任务优先级。 */
export type TaskPriority = 'must' | 'important' | 'optional';

/** 合法优先级集合。 */
export const TASK_PRIORITIES: readonly TaskPriority[] = ['must', 'important', 'optional'];

/** 预估耗时下限（分钟）。 */
export const MIN_ESTIMATED_MINUTES = 5;
/** 预估耗时上限（分钟）。 */
export const MAX_ESTIMATED_MINUTES = 480;
/** 能量消耗最小值。 */
export const MIN_ENERGY_DEMAND = 1;
/** 能量消耗最大值。 */
export const MAX_ENERGY_DEMAND = 5;
/** 心理阻力最小值（没有阻力）。 */
export const MIN_EMOTIONAL_RESISTANCE = 0;
/** 心理阻力最大值（强烈抗拒）。 */
export const MAX_EMOTIONAL_RESISTANCE = 3;
/** 标题最大长度（去空格后）。 */
export const MAX_TITLE_LENGTH = 100;

/** 最低可行版本：状态差时的降级形态。 */
export interface MinimumViableVersion {
  readonly title: string;
  readonly estimatedMinutes: number;
  readonly energyDemand: number;
}

/** MinimumViableVersion 工厂入参。 */
export interface MinimumViableVersionInput {
  readonly title: string;
  readonly estimatedMinutes: number;
  readonly energyDemand: number;
}

/** 弹性任务。 */
export interface FlexibleTask {
  readonly id: string;
  readonly title: string;
  readonly priority: TaskPriority;
  readonly estimatedMinutes: number;
  /** 预计消耗的能量，1（轻松）至 5（透支）。 */
  readonly energyDemand: number;
  /** 心理阻力，0（无）至 3（强烈抗拒）。 */
  readonly emotionalResistance: number;
  /** 截止时间（毫秒时间戳），可选。 */
  readonly deadlineAtMs?: number;
  /** 最低可行版本，可选。 */
  readonly minimumVersion?: MinimumViableVersion;
}

/** FlexibleTask 工厂入参。 */
export interface FlexibleTaskInput {
  readonly id: string;
  readonly title: string;
  readonly priority: string;
  readonly estimatedMinutes: number;
  readonly energyDemand: number;
  readonly emotionalResistance: number;
  readonly deadlineAtMs?: number;
  readonly minimumVersion?: MinimumViableVersionInput;
}

function isTaskPriority(value: string): value is TaskPriority {
  return (TASK_PRIORITIES as readonly string[]).includes(value);
}

function isFiniteSafeInteger(value: number): boolean {
  return typeof value === 'number' && Number.isFinite(value) && Number.isSafeInteger(value);
}

/**
 * 构造弹性任务。
 *
 * 不变量：
 * - id / title 去空格后非空，title 不超过 MAX_TITLE_LENGTH；
 * - priority 必须为 must / important / optional；
 * - estimatedMinutes 为 5 至 480 的整数；
 * - energyDemand 为 1 至 5 的整数；
 * - emotionalResistance 为 0 至 3 的整数；
 * - deadlineAtMs 若提供，必须为有限的安全整数；
 * - minimumVersion 若提供：title 有效、耗时与能量在合法区间内，
 *   且耗时与能量都不得高于原任务（降级版本不能更重）。
 */
export function createFlexibleTask(input: FlexibleTaskInput, path = 'task'): DomainResult<FlexibleTask> {
  const errors: DomainError[] = [];

  const id = validateRequiredText(errors, input.id, `${path}.id`, 'id', MAX_TITLE_LENGTH);
  const title = validateRequiredText(errors, input.title, `${path}.title`, '标题', MAX_TITLE_LENGTH);

  if (!isTaskPriority(input.priority)) {
    errors.push(
      error(
        'INVALID_PRIORITY',
        `${path}.priority`,
        `priority 必须为 ${TASK_PRIORITIES.join(' / ')} 之一`,
      ),
    );
  }

  validateIntegerInRange(
    errors,
    input.estimatedMinutes,
    `${path}.estimatedMinutes`,
    'estimatedMinutes',
    MIN_ESTIMATED_MINUTES,
    MAX_ESTIMATED_MINUTES,
  );
  validateIntegerInRange(
    errors,
    input.energyDemand,
    `${path}.energyDemand`,
    'energyDemand',
    MIN_ENERGY_DEMAND,
    MAX_ENERGY_DEMAND,
  );
  validateIntegerInRange(
    errors,
    input.emotionalResistance,
    `${path}.emotionalResistance`,
    'emotionalResistance',
    MIN_EMOTIONAL_RESISTANCE,
    MAX_EMOTIONAL_RESISTANCE,
  );

  if (input.deadlineAtMs !== undefined && !isFiniteSafeInteger(input.deadlineAtMs)) {
    errors.push(
      error('INVALID_TIMESTAMP', `${path}.deadlineAtMs`, 'deadlineAtMs 必须为有限的安全整数'),
    );
  }

  let minimumVersion: MinimumViableVersion | undefined;
  if (input.minimumVersion !== undefined) {
    const mvPath = `${path}.minimumVersion`;
    const mvTitle = validateRequiredText(
      errors,
      input.minimumVersion.title,
      `${mvPath}.title`,
      '最低版本标题',
      MAX_TITLE_LENGTH,
    );
    validateIntegerInRange(
      errors,
      input.minimumVersion.estimatedMinutes,
      `${mvPath}.estimatedMinutes`,
      '最低版本 estimatedMinutes',
      MIN_ESTIMATED_MINUTES,
      MAX_ESTIMATED_MINUTES,
    );
    validateIntegerInRange(
      errors,
      input.minimumVersion.energyDemand,
      `${mvPath}.energyDemand`,
      '最低版本 energyDemand',
      MIN_ENERGY_DEMAND,
      MAX_ENERGY_DEMAND,
    );
    if (input.minimumVersion.estimatedMinutes > input.estimatedMinutes) {
      errors.push(
        error(
          'MINIMUM_VERSION_TOO_HEAVY',
          `${mvPath}.estimatedMinutes`,
          '最低版本耗时不得高于原任务',
        ),
      );
    }
    if (input.minimumVersion.energyDemand > input.energyDemand) {
      errors.push(
        error(
          'MINIMUM_VERSION_TOO_HEAVY',
          `${mvPath}.energyDemand`,
          '最低版本能量消耗不得高于原任务',
        ),
      );
    }
    minimumVersion = {
      title: mvTitle,
      estimatedMinutes: input.minimumVersion.estimatedMinutes,
      energyDemand: input.minimumVersion.energyDemand,
    };
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const value: FlexibleTask = {
    id,
    title,
    priority: input.priority as TaskPriority,
    estimatedMinutes: input.estimatedMinutes,
    energyDemand: input.energyDemand,
    emotionalResistance: input.emotionalResistance,
    ...(input.deadlineAtMs !== undefined ? { deadlineAtMs: input.deadlineAtMs } : {}),
    ...(minimumVersion !== undefined ? { minimumVersion } : {}),
  };
  return ok(value);
}
