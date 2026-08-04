import type {
  PlanPreviewInvalidInputResponse,
  PlanPreviewInvalidRequestResponse,
  PlanPreviewSuccessResponse,
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

type Capacity = PlanPreviewSuccessResponse['data']['capacity'];
type ScheduledItem = PlanPreviewSuccessResponse['data']['scheduledItems'][number];
type DeferredItem = PlanPreviewSuccessResponse['data']['deferredItems'][number];

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
      return '固定安排已经把今天挤满了，能守住底线就很好。';
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

export function summarizeCapacity(capacity: Capacity): string[] {
  return [
    `今天一共还能安排 ${formatMinutes(capacity.schedulableMinutes)}。`,
    `系统已经帮你留出 ${formatMinutes(capacity.protectedBufferMinutes)} 的空白。`,
    `做完固定安排后，还剩 ${capacity.remainingEnergyPoints} 点精力可以支配。`,
    describeCapacityState(capacity.capacityState),
  ];
}

export function describeScheduledItem(item: ScheduledItem): string {
  return `${formatLocalTimeRange(item.window.startAtMs, item.window.endAtMs)} · ${item.title}`;
}

export function describeTimelineVariant(item: ScheduledItem): string {
  return item.variant === 'minimum' ? '最低版' : '完整版';
}
