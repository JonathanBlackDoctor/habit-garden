import { describe, expect, it } from 'vitest';
import type { HabitDoc } from '../types/firestore';
import { calculateDayScore, canAwardLiveSuccess, type ScoredCheck } from './dayScoreCalculation';

const habit = (id: string, scoreMode: HabitDoc['scoreMode'], weight = 5): HabitDoc => ({ id, title: id, scoreMode, weight, order: 0, active: true, timeOfDay: 'anytime', achieveThreshold: scoreMode === 'scaled' ? 3 : 1, iconName: 'leaf' });
const check = (habitId: string, score: number | null, achieved: boolean, snapshot?: ScoredCheck['habitSnapshot']): ScoredCheck => ({ habitId, score, achieved, habitSnapshot: snapshot, checkedAt: {} as any });

describe('historical day scores', () => {
  it('uses the original score mode after a scaled habit becomes binary', () => {
    expect(calculateDayScore([check('h', 3, true, { scoreMode: 'scaled', weight: 5 })], { h: habit('h', 'binary') }).dayScore).toBe(50);
  });
  it('keeps original weights after current habits are reweighted', () => {
    expect(calculateDayScore([check('a', 1, true, { weight: 5, scoreMode: 'binary' }), check('b', 0, false, { weight: 5, scoreMode: 'binary' })], { a: habit('a', 'binary', 10), b: habit('b', 'binary', 1) }).dayScore).toBe(50);
  });
  it('supports legacy records without snapshots and removed definitions with snapshots', () => {
    expect(calculateDayScore([check('a', 1, true)], { a: habit('a', 'binary') }).dayScore).toBe(100);
    expect(calculateDayScore([check('gone', 5, true, { scoreMode: 'scaled', weight: 5 })], {}).dayScore).toBe(100);
  });
  it('keeps skip handling and empty-score behavior compatible', () => {
    expect(calculateDayScore([check('a', null, false)], { a: habit('a', 'binary') })).toEqual({ dayScore: 0, isSuccessDay: false });
    expect(calculateDayScore([], {})).toEqual({ dayScore: 0, isSuccessDay: false });
  });
  it('never increments the live streak from an edited past or future day', () => {
    expect(canAwardLiveSuccess(true, '2026-10-18', '2026-10-19')).toBe(false);
    expect(canAwardLiveSuccess(true, '2026-10-20', '2026-10-19')).toBe(false);
    expect(canAwardLiveSuccess(true, '2026-10-19', '2026-10-19')).toBe(true);
    expect(canAwardLiveSuccess(false, '2026-10-19', '2026-10-19')).toBe(false);
  });
});
