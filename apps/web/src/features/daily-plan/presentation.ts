import type {
  DailySchedule,
  PlanPreviewInvalidInputResponse,
  PlanPreviewInvalidRequestResponse,
} from '@today-dont-push/contracts';
import type { FormIssue } from './model';
import { formatLocalTimeRange, formatMinutes } from './time';

export type ApiError =
  | PlanPreviewInvalidRequestResponse['errors'][number]
  | PlanPreviewInvalidInputResponse['errors'][number];

export interface GroupedIssues {
  readonly top: readonly string[];
  readonly energyLevel: readonly string[];
  readonly strainTags: readonly string[];
  readonly otherNote: readonly string[];
  readonly planningWindows: readonly string[];
  readonly planningWindowByIndex: Readonly<Record<number, readonly string[]>>;
  readonly commitments: readonly string[];
  readonly commitmentByIndex: Readonly<Record<number, readonly string[]>>;
  readonly tasks: readonly string[];
  readonly taskByIndex: Readonly<Record<number, readonly string[]>>;
}

type Capacity = DailySchedule['capacity'];
type ScheduledItem = DailySchedule['scheduledItems'][number];
type DeferredItem = DailySchedule['deferredItems'][number];

export interface ResultGroups {
  readonly mustItems: readonly ScheduledItem[];
  readonly minimumItems: readonly ScheduledItem[];
  readonly extraItems: readonly ScheduledItem[];
}

function pushIndexedIssue(
  bucket: Record<number, string[]>,
  index: number,
  message: string,
) {
  const current = bucket[index] ?? [];
  bucket[index] = [...current, message];
}

function normalizeIssuePath(path: string): string {
  if (path.startsWith('checkIn.energyLevel')) {
    return 'energyLevel';
  }
  if (path.startsWith('checkIn.strainTags')) {
    return 'strainTags';
  }
  if (path.startsWith('checkIn.note')) {
    return 'otherNote';
  }
  return path;
}

function appendIssue(target: string[], message: string) {
  target.push(message);
}

export function groupIssues(issues: readonly FormIssue[]): GroupedIssues {
  const top: string[] = [];
  const energyLevel: string[] = [];
  const strainTags: string[] = [];
  const otherNote: string[] = [];
  const planningWindows: string[] = [];
  const commitments: string[] = [];
  const tasks: string[] = [];
  const planningWindowByIndex: Record<number, string[]> = {};
  const commitmentByIndex: Record<number, string[]> = {};
  const taskByIndex: Record<number, string[]> = {};

  issues.forEach((issue) => {
    const path = normalizeIssuePath(issue.path);
    if (path === 'energyLevel') {
      appendIssue(energyLevel, issue.message);
      return;
    }
    if (path === 'strainTags') {
      appendIssue(strainTags, issue.message);
      return;
    }
    if (path === 'otherNote') {
      appendIssue(otherNote, issue.message);
      return;
    }
    if (path === 'planningWindows') {
      appendIssue(planningWindows, issue.message);
      return;
    }
    const planningMatch = /^planningWindows\[(\d+)\]/.exec(path);
    if (planningMatch !== null) {
      pushIndexedIssue(planningWindowByIndex, Number(planningMatch[1]), issue.message);
      return;
    }
    if (path === 'commitments') {
      appendIssue(commitments, issue.message);
      return;
    }
    const commitmentMatch = /^commitments\[(\d+)\]/.exec(path);
    if (commitmentMatch !== null) {
      pushIndexedIssue(commitmentByIndex, Number(commitmentMatch[1]), issue.message);
      return;
    }
    if (path === 'tasks') {
      appendIssue(tasks, issue.message);
      return;
    }
    const taskMatch = /^tasks\[(\d+)\]/.exec(path);
    if (taskMatch !== null) {
      pushIndexedIssue(taskByIndex, Number(taskMatch[1]), issue.message);
      return;
    }
    appendIssue(top, issue.message);
  });

  return {
    top,
    energyLevel,
    strainTags,
    otherNote,
    planningWindows,
    planningWindowByIndex,
    commitments,
    commitmentByIndex,
    tasks,
    taskByIndex,
  };
}

export function apiErrorsToFormIssues(errors: readonly ApiError[]): FormIssue[] {
  return errors.map((error) => ({
    path: error.path,
    message: error.message,
  }));
}

export function describeCapacityState(state: Capacity['capacityState']): string {
  switch (state) {
    case 'available':
      return '今天还有可用空间，可以稳稳地推进。';
    case 'commitment_heavy':
      return '固定安排偏多，适合收束重点，别把自己排太满。';
    case 'exhausted_by_commitments':
      return '今天已经没有剩余的可安排容量了，能守住底线就很好。';
  }
}

export function describeDeferredReason(item: DeferredItem): string {
  const firstReason = item.reasonCodes[0];
  switch (firstReason) {
    case 'CAPACITY_EXHAUSTED':
      return '今天能放进去的时间已经满了。';
    case 'INSUFFICIENT_ENERGY':
      return '剩下的精力不够，再硬撑只会更累。';
    case 'INSUFFICIENT_TOTAL_MINUTES':
      return '今天剩余的整块时间不够。';
    case 'NO_CONTIGUOUS_SLOT':
      return '今天没有合适的连续时间段。';
    case 'DEADLINE_CANNOT_BE_MET':
      return '按现在的安排，已经赶不上它的截止时间。';
    default:
      return item.reasons[0]?.message ?? '今天先不把它排进去。';
  }
}

export function summarizeCapacity(schedule: DailySchedule): string[] {
  const scheduledMinutes = schedule.capacity.schedulableMinutes - schedule.remainingSchedulableMinutes;
  return [
    `原始可用于弹性任务的时间：${formatMinutes(schedule.capacity.schedulableMinutes)}。`,
    `这次已经安排了 ${formatMinutes(scheduledMinutes)}。`,
    `系统主动保护了 ${formatMinutes(schedule.capacity.protectedBufferMinutes)} 的空白。`,
    `计划排完后，还剩 ${formatMinutes(schedule.remainingSchedulableMinutes)} 可安排时间。`,
    `固定安排后可用能量：${schedule.capacity.remainingEnergyPoints} 点。`,
    `计划排完后剩余能量：${schedule.remainingEnergyPoints} 点。`,
    describeCapacityState(schedule.capacity.capacityState),
  ];
}

export function groupScheduledItems(schedule: DailySchedule): ResultGroups {
  const mustItems: ScheduledItem[] = [];
  const minimumItems: ScheduledItem[] = [];
  const extraItems: ScheduledItem[] = [];

  schedule.scheduledItems.forEach((item) => {
    if (item.priority === 'must') {
      mustItems.push(item);
      return;
    }
    if (item.variant === 'minimum') {
      minimumItems.push(item);
      return;
    }
    extraItems.push(item);
  });

  return {
    mustItems,
    minimumItems,
    extraItems,
  };
}

export function describeScheduledItem(item: ScheduledItem): string {
  return `${formatLocalTimeRange(item.window.startAtMs, item.window.endAtMs)} · ${item.title}`;
}

export function describeTimelineVariant(item: ScheduledItem): string {
  return item.variant === 'minimum' ? '最低版' : '完整版';
}
