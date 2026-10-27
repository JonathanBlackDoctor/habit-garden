import { describe, expect, it } from 'vitest';
import { nextPlannerDayBoundary, plannerDate } from './dayBoundary';

describe('04:00 KST planner date boundary', () => {
  it('keeps yesterday until 03:59:59 KST and rolls over exactly at 04:00', () => {
    const before = new Date('2026-10-26T18:59:59.999Z'); // 10/27 03:59:59.999 KST
    const after = new Date('2026-10-26T19:00:00.000Z'); // 10/27 04:00 KST

    expect(plannerDate(before)).toBe('2026-10-26');
    expect(plannerDate(after)).toBe('2026-10-27');
    expect(nextPlannerDayBoundary(before).toISOString()).toBe('2026-10-26T19:00:00.000Z');
    expect(nextPlannerDayBoundary(after).toISOString()).toBe('2026-10-27T19:00:00.000Z');
  });

  it('handles year rollover and device time zones independently', () => {
    const before = new Date('2026-12-31T18:59:59.999Z'); // 2027/1/1 03:59 KST
    const after = new Date('2026-12-31T19:00:00.000Z'); // 2027/1/1 04:00 KST
    expect(plannerDate(before)).toBe('2026-12-31');
    expect(plannerDate(after)).toBe('2027-01-01');
    expect(nextPlannerDayBoundary(before).toISOString()).toBe('2026-12-31T19:00:00.000Z');
    expect(nextPlannerDayBoundary(after).toISOString()).toBe('2027-01-01T19:00:00.000Z');
  });

  it('handles the next-day boundary at night without switching early', () => {
    const evening = new Date('2026-10-27T14:59:59.000Z'); // 10/27 23:59 KST
    const midnight = new Date('2026-10-27T15:00:00.000Z'); // 10/28 00:00 KST
    expect(plannerDate(evening)).toBe('2026-10-27');
    expect(plannerDate(midnight)).toBe('2026-10-27');
    expect(nextPlannerDayBoundary(midnight).toISOString()).toBe('2026-10-27T19:00:00.000Z');
  });
});
