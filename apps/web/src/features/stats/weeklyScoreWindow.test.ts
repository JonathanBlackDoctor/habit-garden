import { describe, expect, it } from 'vitest';
import { changeScoreWeek, scoreWeekAfterDrag, weeklyScoreDates, MAX_SCORE_WEEKS } from './weeklyScoreWindow';

describe('7-day score history navigation', () => {
  it('starts at the most recent 7 planner days and moves back in 7-day pages', () => {
    expect(weeklyScoreDates('2026-10-27', 0)).toEqual([
      '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24',
      '2026-10-25', '2026-10-26', '2026-10-27',
    ]);
    expect(weeklyScoreDates('2026-10-27', 1)).toEqual([
      '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17',
      '2026-10-18', '2026-10-19', '2026-10-20',
    ]);
    expect(weeklyScoreDates('2026-01-02', 1)).toEqual([
      '2025-12-20', '2025-12-21', '2025-12-22', '2025-12-23',
      '2025-12-24', '2025-12-25', '2025-12-26',
    ]);
  });

  it('swipes right to older history, left to recent history, without moving into future', () => {
    expect(scoreWeekAfterDrag(0, 100, 10)).toBe(1);
    expect(scoreWeekAfterDrag(1, -100, 8)).toBe(0);
    expect(scoreWeekAfterDrag(0, -100, 8)).toBe(0);
    expect(changeScoreWeek(MAX_SCORE_WEEKS, 'older')).toBe(MAX_SCORE_WEEKS);
  });

  it('ignores small movements and vertical scrolling', () => {
    expect(scoreWeekAfterDrag(3, 35, 0)).toBe(3);
    expect(scoreWeekAfterDrag(3, 65, 90)).toBe(3);
    expect(scoreWeekAfterDrag(3, -48, 40)).toBe(3);
  });
});
