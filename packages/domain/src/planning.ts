/**
 * 每日规划输入领域模型。
 *
 * DailyPlanningInput 是"今天"的完整画像：签到状态 + 可用时间 +
 * 固定承诺 + 弹性任务。未来的调度算法只消费这个结构。
 *
 * 领域层不解释时区（timeZone 只要求非空、原样保存），
 * localDate 只要求是合法的 YYYY-MM-DD 日历日期。
 */
import {
  createDailyCheckIn,
  type DailyCheckIn,
  type DailyCheckInInput,
} from './check-in.js';
import {
  createFixedCommitment,
  type FixedCommitment,
  type FixedCommitmentInput,
} from './fixed-commitment.js';
import {
  createFlexibleTask,
  type FlexibleTask,
  type FlexibleTaskInput,
} from './flexible-task.js';
import {
  error,
  ok,
  validateRequiredText,
  type DomainError,
  type DomainResult,
} from './shared.js';
import { createTimeWindow, windowsOverlap, windowWithin, type TimeWindow, type TimeWindowInput } from './time.js';

/** timeZone 字段最大长度。 */
export const MAX_TIME_ZONE_LENGTH = 64;
/** localDate 最大长度（YYYY-MM-DD）。 */
export const MAX_LOCAL_DATE_LENGTH = 10;

/** 每日规划输入。 */
export interface DailyPlanningInput {
  readonly id: string;
  /** 本地日历日期，YYYY-MM-DD。 */
  readonly localDate: string;
  /** IANA 时区名（如 Asia/Shanghai），原样保存，领域层不解释。 */
  readonly timeZone: string;
  readonly checkIn: DailyCheckIn;
  /** 可用时间段：按开始时间排序、互不重叠。 */
  readonly availability: readonly TimeWindow[];
  readonly commitments: readonly FixedCommitment[];
  /** 允许为空。 */
  readonly tasks: readonly FlexibleTask[];
}

/** DailyPlanningInput 工厂入参。 */
export interface DailyPlanningInputInput {
  readonly id: string;
  readonly localDate: string;
  readonly timeZone: string;
  readonly checkIn: DailyCheckInInput;
  readonly availability: readonly TimeWindowInput[];
  readonly commitments: readonly FixedCommitmentInput[];
  readonly tasks: readonly FlexibleTaskInput[];
}

/** 闰年判断（公历）。 */
function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** 校验 YYYY-MM-DD 是否为真实存在的日历日期（纯算术，不依赖 Date）。 */
function isValidLocalDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) {
    return false;
  }
  const maxDay = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  return day >= 1 && day <= maxDay;
}

/**
 * 构造每日规划输入。
 *
 * 不变量：
 * - id 去空格后非空；
 * - localDate 为真实存在的 YYYY-MM-DD；timeZone 去空格后非空；
 * - checkIn 合法；
 * - availability 至少一个、每项为合法窗口；返回结果按开始时间排序且互不重叠；
 * - commitments 每项合法、互不重叠，且每项必须完全位于某个 availability 内；
 * - commitments 与 tasks 的 id 在同一天内必须唯一；
 * - tasks 允许为空，每项合法。
 */
export function createDailyPlanningInput(
  input: DailyPlanningInputInput,
): DomainResult<DailyPlanningInput> {
  const errors: DomainError[] = [];

  const id = validateRequiredText(errors, input.id, 'id', 'id', MAX_LOCAL_DATE_LENGTH * 6);

  const localDate = input.localDate?.trim() ?? '';
  if (!isValidLocalDate(localDate)) {
    errors.push(error('INVALID_LOCAL_DATE', 'localDate', 'localDate 必须为合法的 YYYY-MM-DD 日期'));
  }

  const timeZone = validateRequiredText(
    errors,
    input.timeZone ?? '',
    'timeZone',
    'timeZone',
    MAX_TIME_ZONE_LENGTH,
  );

  let checkIn: DailyCheckIn | undefined;
  const checkInResult = createDailyCheckIn(input.checkIn);
  if (checkInResult.ok) {
    checkIn = checkInResult.value;
  } else {
    errors.push(...checkInResult.errors);
  }

  // availability：逐项校验窗口，再校验排序无关的重叠性，返回按开始时间排序。
  const availability: TimeWindow[] = [];
  input.availability.forEach((windowInput, index) => {
    const result = createTimeWindow(windowInput, `availability[${index}]`);
    if (result.ok) {
      availability.push(result.value);
    } else {
      errors.push(...result.errors);
    }
  });
  if (input.availability.length === 0) {
    errors.push(error('EMPTY_AVAILABILITY', 'availability', 'availability 至少需要一个时间窗口'));
  }
  for (let i = 0; i < availability.length; i += 1) {
    for (let j = i + 1; j < availability.length; j += 1) {
      if (windowsOverlap(availability[i], availability[j])) {
        errors.push(
          error(
            'OVERLAPPING_AVAILABILITY',
            `availability[${j}]`,
            `availability[${i}] 与 availability[${j}] 重叠`,
          ),
        );
      }
    }
  }
  availability.sort((a, b) => a.startAtMs - b.startAtMs);

  // commitments：逐项校验，再校验互不重叠、完全位于某个 availability 内。
  const commitments: FixedCommitment[] = [];
  input.commitments.forEach((commitmentInput, index) => {
    const result = createFixedCommitment(commitmentInput);
    if (result.ok) {
      commitments.push(result.value);
    } else {
      errors.push(
        ...result.errors.map((e) => ({ ...e, path: `commitments[${index}].${e.path}` })),
      );
    }
  });
  for (let i = 0; i < commitments.length; i += 1) {
    for (let j = i + 1; j < commitments.length; j += 1) {
      if (windowsOverlap(commitments[i].window, commitments[j].window)) {
        errors.push(
          error(
            'OVERLAPPING_COMMITMENTS',
            `commitments[${j}]`,
            `commitments[${i}] 与 commitments[${j}] 时间重叠`,
          ),
        );
      }
    }
  }
  if (availability.length > 0) {
    commitments.forEach((commitment, index) => {
      const covered = availability.some((window) => windowWithin(commitment.window, window));
      if (!covered) {
        errors.push(
          error(
            'COMMITMENT_OUTSIDE_AVAILABILITY',
            `commitments[${index}]`,
            '固定承诺必须完全位于某个可用时间段内',
          ),
        );
      }
    });
  }

  // tasks：允许为空，逐项校验。
  const tasks: FlexibleTask[] = [];
  input.tasks.forEach((taskInput, index) => {
    const result = createFlexibleTask(taskInput, `tasks[${index}]`);
    if (result.ok) {
      tasks.push(result.value);
    } else {
      errors.push(...result.errors);
    }
  });

  // commitments 与 tasks 的 id 在同一天内必须唯一。
  const seenIds = new Map<string, string>();
  commitments.forEach((commitment, index) => {
    const owner = seenIds.get(commitment.id);
    if (owner !== undefined) {
      errors.push(
        error('DUPLICATE_ID', `commitments[${index}].id`, `id 与 ${owner} 重复: ${commitment.id}`),
      );
    } else {
      seenIds.set(commitment.id, `commitments[${index}]`);
    }
  });
  tasks.forEach((task, index) => {
    const owner = seenIds.get(task.id);
    if (owner !== undefined) {
      errors.push(
        error('DUPLICATE_ID', `tasks[${index}].id`, `id 与 ${owner} 重复: ${task.id}`),
      );
    } else {
      seenIds.set(task.id, `tasks[${index}]`);
    }
  });

  if (errors.length > 0 || checkIn === undefined) {
    return { ok: false, errors };
  }
  return ok({
    id,
    localDate,
    timeZone,
    checkIn,
    availability,
    commitments,
    tasks,
  });
}
