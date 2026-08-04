import type { PlanPreviewRequest } from '@today-dont-push/contracts';
import type { CreateId, DailyPlanFormState, FormIssue, TaskDraft } from './model';
import { combineLocalDateAndTime, parseLocalDateTime } from './time';

interface BuildRequestOptions {
  readonly createId: CreateId;
  readonly timeZone: string;
}

type BuildRequestResult =
  | { readonly ok: true; readonly request: PlanPreviewRequest }
  | { readonly ok: false; readonly errors: readonly FormIssue[] };

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

function parsePositiveInteger(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
}

function resolveTaskEstimatedMinutes(task: TaskDraft): number | undefined {
  if (task.estimatedMinutesPreset === 'custom') {
    return parsePositiveInteger(task.customEstimatedMinutes);
  }
  return Number(task.estimatedMinutesPreset);
}

function validatePlanningWindows(state: DailyPlanFormState, issues: FormIssue[]) {
  if (state.planningWindows.length === 0) {
    issues.push({
      path: 'planningWindows',
      message: '至少保留一个可安排时间。',
    });
    return;
  }

  state.planningWindows.forEach((window, index) => {
    if (isBlank(window.startTime) || isBlank(window.endTime)) {
      issues.push({
        path: `planningWindows[${index}]`,
        message: '请把开始和结束时间补完整。',
      });
      return;
    }

    try {
      const startAtMs = combineLocalDateAndTime(state.localDate, window.startTime);
      const endAtMs = combineLocalDateAndTime(state.localDate, window.endTime);
      if (startAtMs >= endAtMs) {
        issues.push({
          path: `planningWindows[${index}]`,
          message: '可安排时间的开始必须早于结束。',
        });
      }
    } catch {
      issues.push({
        path: `planningWindows[${index}]`,
        message: '可安排时间的格式不正确。',
      });
    }
  });
}

function validateCommitments(state: DailyPlanFormState, issues: FormIssue[]) {
  state.commitments.forEach((commitment, index) => {
    if (isBlank(commitment.title)) {
      issues.push({
        path: `commitments[${index}].title`,
        message: '请写下这项固定安排的名称。',
      });
    }

    if (isBlank(commitment.startAt) || isBlank(commitment.endAt)) {
      issues.push({
        path: `commitments[${index}]`,
        message: '固定安排需要完整的开始和结束时间。',
      });
      return;
    }

    try {
      const startAtMs = combineLocalDateAndTime(state.localDate, commitment.startAt);
      const endAtMs = combineLocalDateAndTime(state.localDate, commitment.endAt);
      if (startAtMs >= endAtMs) {
        issues.push({
          path: `commitments[${index}]`,
          message: '固定安排的开始必须早于结束。',
        });
      }
    } catch {
      issues.push({
        path: `commitments[${index}]`,
        message: '固定安排的时间格式不正确。',
      });
    }
  });
}

function validateTasks(state: DailyPlanFormState, issues: FormIssue[]) {
  state.tasks.forEach((task, index) => {
    if (isBlank(task.title)) {
      issues.push({
        path: `tasks[${index}].title`,
        message: '请写下这件事的名称。',
      });
    }

    const estimatedMinutes = resolveTaskEstimatedMinutes(task);
    if (estimatedMinutes === undefined) {
      issues.push({
        path: `tasks[${index}].estimatedMinutes`,
        message: '请填写有效的预计时间。',
      });
    }

    if (task.deadlineAt.trim().length > 0) {
      try {
        parseLocalDateTime(task.deadlineAt);
      } catch {
        issues.push({
          path: `tasks[${index}].deadlineAtMs`,
          message: '截止时间格式不正确。',
        });
      }
    }

    if (!task.minimumVersionEnabled) {
      return;
    }

    if (
      isBlank(task.minimumTitle) ||
      parsePositiveInteger(task.minimumEstimatedMinutes) === undefined
    ) {
      issues.push({
        path: `tasks[${index}].minimumVersion`,
        message: '过关版本需要补完整名称和预计时间。',
      });
    }
  });
}

export function buildPlanPreviewRequest(
  state: DailyPlanFormState,
  options: BuildRequestOptions,
): BuildRequestResult {
  const issues: FormIssue[] = [];

  if (isBlank(state.localDate)) {
    issues.push({
      path: 'localDate',
      message: '今天的日期不能为空。',
    });
  }

  if (state.strainTags.includes('other') && isBlank(state.otherNote)) {
    issues.push({
      path: 'otherNote',
      message: '选了“其他”后，请补一句说明。',
    });
  }

  validatePlanningWindows(state, issues);
  validateCommitments(state, issues);
  validateTasks(state, issues);

  if (issues.length > 0) {
    return { ok: false, errors: issues };
  }

  return {
    ok: true,
    request: {
      id: options.createId(),
      localDate: state.localDate,
      timeZone: options.timeZone,
      checkIn: {
        id: options.createId(),
        energyLevel: state.energyLevel,
        strainTags: [...state.strainTags],
        ...(state.strainTags.includes('other')
          ? { note: state.otherNote.trim() }
          : {}),
      },
      planningWindows: state.planningWindows.map((window) => ({
        startAtMs: combineLocalDateAndTime(state.localDate, window.startTime),
        endAtMs: combineLocalDateAndTime(state.localDate, window.endTime),
      })),
      commitments: state.commitments.map((commitment) => ({
        id: commitment.id,
        title: commitment.title.trim(),
        window: {
          startAtMs: combineLocalDateAndTime(state.localDate, commitment.startAt),
          endAtMs: combineLocalDateAndTime(state.localDate, commitment.endAt),
        },
        energyDemand: commitment.energyDemand,
      })),
      tasks: state.tasks.map((task) => ({
        id: task.id,
        title: task.title.trim(),
        priority: task.priority,
        estimatedMinutes: resolveTaskEstimatedMinutes(task) ?? 0,
        energyDemand: task.energyDemand,
        emotionalResistance: task.emotionalResistance,
        ...(task.deadlineAt.trim().length > 0
          ? { deadlineAtMs: parseLocalDateTime(task.deadlineAt) }
          : {}),
        ...(task.minimumVersionEnabled
          ? {
              minimumVersion: {
                title: task.minimumTitle.trim(),
                estimatedMinutes: parsePositiveInteger(task.minimumEstimatedMinutes) ?? 0,
                energyDemand: task.minimumEnergyDemand,
              },
            }
          : {}),
      })),
    },
  };
}
