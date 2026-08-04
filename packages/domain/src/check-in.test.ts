import { describe, expect, it } from 'vitest';
import { createDailyCheckIn } from './check-in.js';

describe('createDailyCheckIn', () => {
  it('构造合法签到（无 note）', () => {
    const result = createDailyCheckIn({
      id: 'checkin-2026-08-04',
      energyLevel: 50,
      strainTags: ['poor_sleep', 'meeting_heavy'],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id).toBe('checkin-2026-08-04');
      expect(result.value.energyLevel).toBe(50);
      expect(result.value.strainTags).toEqual(['poor_sleep', 'meeting_heavy']);
      expect(result.value.note).toBeUndefined();
    }
  });

  it('选择 other 且提供 note 时合法，note 去除首尾空格', () => {
    const result = createDailyCheckIn({
      id: 'c1',
      energyLevel: 20,
      strainTags: ['other'],
      note: '  家里有事  ',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.note).toBe('家里有事');
    }
  });

  it.each([0, 65, 100, 2.5, NaN])('拒绝非法能量值 %s', (level) => {
    const result = createDailyCheckIn({ id: 'c1', energyLevel: level, strainTags: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'INVALID_ENERGY_LEVEL')).toBe(true);
    }
  });

  it('接受全部三个合法能量档位', () => {
    for (const level of [20, 50, 80]) {
      const result = createDailyCheckIn({ id: 'c1', energyLevel: level, strainTags: [] });
      expect(result.ok).toBe(true);
    }
  });

  it('拒绝重复的 strainTag', () => {
    const result = createDailyCheckIn({
      id: 'c1',
      energyLevel: 50,
      strainTags: ['poor_sleep', 'poor_sleep'],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'DUPLICATE_STRAIN_TAG')).toBe(true);
    }
  });

  it('拒绝非法 strainTag', () => {
    const result = createDailyCheckIn({
      id: 'c1',
      energyLevel: 50,
      strainTags: ['not_a_tag'],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'INVALID_STRAIN_TAG')).toBe(true);
    }
  });

  it('选择 other 但没有 note 时拒绝', () => {
    const result = createDailyCheckIn({ id: 'c1', energyLevel: 50, strainTags: ['other'] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'NOTE_REQUIRED')).toBe(true);
    }
  });

  it('选择 other 且 note 全为空白时拒绝', () => {
    const result = createDailyCheckIn({
      id: 'c1',
      energyLevel: 50,
      strainTags: ['other'],
      note: '   ',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'NOTE_REQUIRED')).toBe(true);
    }
  });

  it('拒绝超长 note', () => {
    const result = createDailyCheckIn({
      id: 'c1',
      energyLevel: 50,
      strainTags: ['low_mood'],
      note: '字'.repeat(201),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'TEXT_TOO_LONG')).toBe(true);
    }
  });

  it('拒绝空 id', () => {
    const result = createDailyCheckIn({ id: '  ', energyLevel: 50, strainTags: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'INVALID_TEXT' && e.path === 'checkIn.id')).toBe(
        true,
      );
    }
  });

  it('一次收集多条错误', () => {
    const result = createDailyCheckIn({
      id: '',
      energyLevel: 42,
      strainTags: ['poor_sleep', 'poor_sleep', 'other'],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const codes = result.errors.map((e) => e.code);
      expect(codes).toContain('INVALID_TEXT');
      expect(codes).toContain('INVALID_ENERGY_LEVEL');
      expect(codes).toContain('DUPLICATE_STRAIN_TAG');
      expect(codes).toContain('NOTE_REQUIRED');
    }
  });
});
