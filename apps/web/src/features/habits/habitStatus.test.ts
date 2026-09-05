import { describe, expect, it } from 'vitest';
import type { HabitCheckDoc } from 'shared/types/firestore';
import { statusOf } from './habitStatus';

const check = (score: number | null, achieved: boolean): HabitCheckDoc => ({
  score,
  achieved,
} as HabitCheckDoc);

describe('binary habit quick cycle statuses', () => {
  it('distinguishes empty, achieved, missed, and skipped records', () => {
    expect(statusOf(undefined)).toBe('todo');
    expect(statusOf(check(1, true))).toBe('achieved');
    expect(statusOf(check(0, false))).toBe('missed');
    expect(statusOf(check(null, false))).toBe('skipped');
  });
});
