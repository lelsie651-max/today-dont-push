export type EnergyLevel = 20 | 50 | 80;
export type StrainTag =
  | 'poor_sleep'
  | 'physical_discomfort'
  | 'low_mood'
  | 'exhausting_commute'
  | 'meeting_heavy'
  | 'urgent_deadline'
  | 'interpersonal_stress'
  | 'other';
export type TaskPriority = 'must' | 'important' | 'optional';
export type EstimatedMinutesPreset = '15' | '30' | '60' | '90' | 'custom';

export interface PlanningWindowDraft {
  readonly id: string;
  readonly startTime: string;
  readonly endTime: string;
}

export interface CommitmentDraft {
  readonly id: string;
  readonly title: string;
  readonly startAt: string;
  readonly endAt: string;
  readonly energyDemand: 1 | 3 | 5;
}

export interface TaskDraft {
  readonly id: string;
  readonly title: string;
  readonly priority: TaskPriority;
  readonly estimatedMinutesPreset: EstimatedMinutesPreset;
  readonly customEstimatedMinutes: string;
  readonly energyDemand: 1 | 3 | 5;
  readonly emotionalResistance: 0 | 1 | 2 | 3;
  readonly deadlineAt: string;
  readonly minimumVersionEnabled: boolean;
  readonly minimumTitle: string;
  readonly minimumEstimatedMinutes: string;
  readonly minimumEnergyDemand: 1 | 3 | 5;
}

export interface DailyPlanFormState {
  readonly localDate: string;
  readonly energyLevel: EnergyLevel;
  readonly strainTags: readonly StrainTag[];
  readonly otherNote: string;
  readonly planningWindows: readonly PlanningWindowDraft[];
  readonly commitments: readonly CommitmentDraft[];
  readonly tasks: readonly TaskDraft[];
}

export interface FormIssue {
  readonly path: string;
  readonly message: string;
}

export type CreateId = () => string;

export const ENERGY_OPTIONS = [
  {
    value: 20 as EnergyLevel,
    label: '20%',
    description: '今天只想把必要的事守住',
  },
  {
    value: 50 as EnergyLevel,
    label: '50%',
    description: '可以正常做事，但需要留余地',
  },
  {
    value: 80 as EnergyLevel,
    label: '80%',
    description: '今天状态不错，可以向前推进',
  },
] as const;

export const STRAIN_OPTIONS = [
  { value: 'poor_sleep' as StrainTag, label: '没睡好' },
  { value: 'physical_discomfort' as StrainTag, label: '身体不舒服' },
  { value: 'low_mood' as StrainTag, label: '情绪有点低' },
  { value: 'exhausting_commute' as StrainTag, label: '通勤很累' },
  { value: 'meeting_heavy' as StrainTag, label: '会议很多' },
  { value: 'urgent_deadline' as StrainTag, label: '有紧急截止' },
  { value: 'interpersonal_stress' as StrainTag, label: '和人发生了不愉快' },
  { value: 'other' as StrainTag, label: '其他' },
] as const;

export const PRIORITY_OPTIONS = [
  { value: 'must' as TaskPriority, label: '今天必须守住' },
  { value: 'important' as TaskPriority, label: '重要但可以调整' },
  { value: 'optional' as TaskPriority, label: '有余力再做' },
] as const;

export const ENERGY_DEMAND_OPTIONS = [
  { value: 1 as const, label: '轻松' },
  { value: 3 as const, label: '一般' },
  { value: 5 as const, label: '很累' },
] as const;

export const TASK_ENERGY_OPTIONS = [
  { value: 1 as const, label: '轻' },
  { value: 3 as const, label: '一般' },
  { value: 5 as const, label: '重' },
] as const;

export const RESISTANCE_OPTIONS = [
  { value: 0 as const, label: '不抗拒' },
  { value: 1 as const, label: '有点难开始' },
  { value: 2 as const, label: '很不想做' },
  { value: 3 as const, label: '光想就累' },
] as const;

export const ESTIMATED_MINUTES_OPTIONS = [
  { value: '15' as EstimatedMinutesPreset, label: '15 分钟' },
  { value: '30' as EstimatedMinutesPreset, label: '30 分钟' },
  { value: '60' as EstimatedMinutesPreset, label: '60 分钟' },
  { value: '90' as EstimatedMinutesPreset, label: '90 分钟' },
  { value: 'custom' as EstimatedMinutesPreset, label: '自定义' },
] as const;

export function createBrowserId(): string {
  return crypto.randomUUID();
}

export function createPlanningWindowDraft(createId: CreateId): PlanningWindowDraft {
  return {
    id: createId(),
    startTime: '09:00',
    endTime: '18:00',
  };
}

export function createCommitmentDraft(createId: CreateId): CommitmentDraft {
  return {
    id: createId(),
    title: '',
    startAt: '10:00',
    endAt: '11:00',
    energyDemand: 3,
  };
}

export function createTaskDraft(createId: CreateId): TaskDraft {
  return {
    id: createId(),
    title: '',
    priority: 'must',
    estimatedMinutesPreset: '60',
    customEstimatedMinutes: '',
    energyDemand: 3,
    emotionalResistance: 1,
    deadlineAt: '',
    minimumVersionEnabled: false,
    minimumTitle: '',
    minimumEstimatedMinutes: '',
    minimumEnergyDemand: 1,
  };
}

export function createInitialFormState(
  createId: CreateId,
  localDate: string,
): DailyPlanFormState {
  return {
    localDate,
    energyLevel: 50,
    strainTags: [],
    otherNote: '',
    planningWindows: [createPlanningWindowDraft(createId)],
    commitments: [],
    tasks: [createTaskDraft(createId)],
  };
}
