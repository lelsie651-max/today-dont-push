/**
 * 今日状态（每日签到）领域模型。
 *
 * 用户每天先回答"今天状态如何"，产出能量档位与负担标签，
 * 作为当日规划的输入之一。
 */
import {
  error,
  ok,
  trimText,
  type DomainError,
  type DomainResult,
} from './shared.js';

/** 能量档位：只有 20（低）、50（中）、80（高）三档。 */
export type EnergyLevel = 20 | 50 | 80;

/** 合法能量档位集合。 */
export const ENERGY_LEVELS: readonly EnergyLevel[] = [20, 50, 80];

/** 负担标签：描述今天为什么累。 */
export type StrainTag =
  | 'poor_sleep'
  | 'physical_discomfort'
  | 'low_mood'
  | 'exhausting_commute'
  | 'meeting_heavy'
  | 'urgent_deadline'
  | 'interpersonal_stress'
  | 'other';

/** 合法负担标签集合。 */
export const STRAIN_TAGS: readonly StrainTag[] = [
  'poor_sleep',
  'physical_discomfort',
  'low_mood',
  'exhausting_commute',
  'meeting_heavy',
  'urgent_deadline',
  'interpersonal_stress',
  'other',
];

/** note 最大长度（去空格后）。 */
export const MAX_NOTE_LENGTH = 200;

/** 每日签到。 */
export interface DailyCheckIn {
  readonly id: string;
  readonly energyLevel: EnergyLevel;
  readonly strainTags: readonly StrainTag[];
  /** 选择 other 时必填；其余情况可选。 */
  readonly note?: string;
}

/** DailyCheckIn 工厂入参。 */
export interface DailyCheckInInput {
  readonly id: string;
  readonly energyLevel: number;
  readonly strainTags: readonly string[];
  readonly note?: string;
}

function isEnergyLevel(value: number): value is EnergyLevel {
  return ENERGY_LEVELS.includes(value as EnergyLevel);
}

function isStrainTag(value: string): value is StrainTag {
  return (STRAIN_TAGS as readonly string[]).includes(value);
}

/**
 * 构造每日签到。
 *
 * 不变量：
 * - id 去空格后非空；
 * - energyLevel 严格为 20 / 50 / 80；
 * - strainTags 每一项必须是合法标签，且不得重复；
 * - 选择 other 时 note 必填；
 * - note 去除首尾空格，且不超过 MAX_NOTE_LENGTH。
 */
export function createDailyCheckIn(input: DailyCheckInInput): DomainResult<DailyCheckIn> {
  const errors: DomainError[] = [];

  const id = trimText(input.id ?? '');
  if (id.length === 0) {
    errors.push(error('INVALID_TEXT', 'checkIn.id', 'id 不能为空'));
  }

  if (!isEnergyLevel(input.energyLevel)) {
    errors.push(
      error(
        'INVALID_ENERGY_LEVEL',
        'checkIn.energyLevel',
        `energyLevel 必须为 ${ENERGY_LEVELS.join(' / ')} 之一`,
      ),
    );
  }

  const strainTags: StrainTag[] = [];
  const seen = new Set<StrainTag>();
  input.strainTags.forEach((tag, index) => {
    if (!isStrainTag(tag)) {
      errors.push(error('INVALID_STRAIN_TAG', `checkIn.strainTags[${index}]`, `非法负担标签: ${tag}`));
      return;
    }
    if (seen.has(tag)) {
      errors.push(
        error('DUPLICATE_STRAIN_TAG', `checkIn.strainTags[${index}]`, `负担标签重复: ${tag}`),
      );
      return;
    }
    seen.add(tag);
    strainTags.push(tag);
  });

  const rawNote = input.note === undefined ? undefined : trimText(input.note);
  let note: string | undefined;
  if (rawNote !== undefined && rawNote.length > 0) {
    if (rawNote.length > MAX_NOTE_LENGTH) {
      errors.push(
        error('TEXT_TOO_LONG', 'checkIn.note', `note 长度不能超过 ${MAX_NOTE_LENGTH} 个字符`),
      );
    } else {
      note = rawNote;
    }
  }
  if (seen.has('other') && note === undefined) {
    errors.push(error('NOTE_REQUIRED', 'checkIn.note', '选择 other 时 note 必填'));
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  const value: DailyCheckIn = note === undefined
    ? { id, energyLevel: input.energyLevel as EnergyLevel, strainTags }
    : { id, energyLevel: input.energyLevel as EnergyLevel, strainTags, note };
  return ok(value);
}
