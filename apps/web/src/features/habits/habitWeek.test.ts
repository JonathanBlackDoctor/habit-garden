import { describe, expect, it } from 'vitest';
import type { HabitCheckDoc, HabitDoc } from 'shared/types/firestore';
import { cellAvailability, recordingHabit, shiftDate, weekDates, weekSummary } from './habitWeek';
import { plannerDate } from '@/lib/dayBoundary';

const habit: HabitDoc = { id: 'h', title: '운동', active: true, order: 0, timeOfDay: 'anytime', weight: 5, scoreMode: 'binary', achieveThreshold: 1, iconName: 'leaf' };
const check = (score: number | null, achieved = score === 1): HabitCheckDoc => ({ habitId: 'h', score, achieved, checkedAt: { seconds: 0, nanoseconds: 0 } as any });

describe('weekly habit records', () => {
  it('uses Monday through Sunday across month and year boundaries', () => {
    expect(weekDates('2026-01-01')).toEqual(['2025-12-29', '2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04']);
    expect(weekDates('2026-10-18')[0]).toBe('2026-10-12');
    expect(weekDates('2026-10-19', -1)[6]).toBe('2026-10-18');
    expect(shiftDate('2024-03-01', -1)).toBe('2024-02-29');
  });
  it('does not penalize the remaining six days on Monday', () => {
    expect(weekSummary([habit], weekDates('2026-10-19'), { '2026-10-19': { h: check(1) } }, '2026-10-19'))
      .toEqual({ total: 1, achieved: 1, recorded: 1, skipped: 0, target: 1, rate: 100 });
  });
  it('counts skipped as recorded but excludes it from achievement opportunities', () => {
    const result = weekSummary([habit], weekDates('2026-10-19'), { '2026-10-19': { h: check(null, false) } }, '2026-10-20');
    expect(result).toEqual({ total: 2, achieved: 0, recorded: 1, skipped: 1, target: 1, rate: 0 });
    expect(weekSummary([habit], ['2026-10-19'], { '2026-10-19': { h: check(null, false) } }, '2026-10-19').rate).toBeNull();
  });
  it('keeps missed scores distinct from missing records', () => {
    expect(weekSummary([habit], ['2026-10-19', '2026-10-20'], { '2026-10-19': { h: check(0, false) } }, '2026-10-20').recorded).toBe(1);
  });
  it('excludes new-habit start dates and hibernation without hiding existing history', () => {
    const sleeping = { ...habit, startedOn: '2026-10-15', hibernatedSince: '2026-10-17', hibernatedUntil: null };
    expect(cellAvailability(sleeping, '2026-10-14', '2026-10-19')).toBe('before-start');
    expect(cellAvailability(sleeping, '2026-10-18', '2026-10-19')).toBe('rest');
    expect(cellAvailability(sleeping, '2026-10-18', '2026-10-19', check(1))).toBe('available');
    expect(cellAvailability(sleeping, '2026-10-20', '2026-10-19', check(1))).toBe('future');
  });
  it('shows archived past checks without inventing unrecorded opportunities', () => {
    expect(cellAvailability({ ...habit, active: false }, '2026-10-18', '2026-10-19')).toBe('inactive');
    expect(cellAvailability({ ...habit, active: false }, '2026-10-18', '2026-10-19', check(1))).toBe('available');
  });
  it('edits historical records using their saved score mode and definition', () => {
    const previous = { ...check(4, true), habitSnapshot: { title: '이전 이름', scoreMode: 'scaled', achieveThreshold: 3 } };
    expect(recordingHabit(habit, previous)).toMatchObject({ id: 'h', title: '이전 이름', scoreMode: 'scaled', achieveThreshold: 3 });
  });
  it('keeps the planner date boundary at 04:00 KST', () => {
    expect(plannerDate(new Date('2026-10-18T18:59:59Z'))).toBe('2026-10-18');
    expect(plannerDate(new Date('2026-10-18T19:00:00Z'))).toBe('2026-10-19');
  });
});
