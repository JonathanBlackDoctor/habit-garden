import { describe, expect, it } from 'vitest';
import type { HabitDoc } from 'shared/types/firestore';
import { getHabitOverview, groupHabitsByTime, shouldExpandTimeGroup } from './habitDisplay';

const habit = (
  id: string,
  timeOfDay: HabitDoc['timeOfDay'] = 'morning',
  active = true,
): HabitDoc => ({
  id,
  title: id,
  weight: 1,
  timeOfDay,
  order: 0,
  scoreMode: 'binary',
  achieveThreshold: 1,
  iconName: 'circle',
  active,
});

describe('habit display calculations', () => {
  it('returns stable zero rates for an empty day', () => {
    expect(getHabitOverview([], {})).toEqual({
      total: 0,
      achieved: 0,
      recorded: 0,
      remaining: 0,
      achievementRate: 0,
      recordRate: 0,
    });
  });

  it('separates achievement from all recorded outcomes', () => {
    const habits = [habit('done'), habit('score'), habit('skip'), habit('waiting'), habit('inactive', 'night', false)];
    const result = getHabitOverview(habits, {
      done: { score: 1, achieved: true },
      score: { score: 2, achieved: false },
      skip: { score: null, achieved: false },
      inactive: { score: 1, achieved: true },
    });

    expect(result).toMatchObject({ total: 4, achieved: 1, recorded: 3, remaining: 1 });
    expect(result.achievementRate).toBe(0.25);
    expect(result.recordRate).toBe(0.75);
  });

  it('groups existing documents without changing their shape or order', () => {
    const habits = [habit('a'), habit('b', 'evening'), habit('c')];
    const grouped = groupHabitsByTime(habits);

    expect(grouped.morning?.map(({ id }) => id)).toEqual(['a', 'c']);
    expect(grouped.evening?.map(({ id }) => id).toEqual(['b']);
  });

  it('opens only the current group by default and toggles either default state manually', () => {
    expect(shouldExpandTimeGroup({ editMode: false, timeOfDay: 'morning', currentTimeOfDay: 'morning', manuallyToggled: [] })).toBe(true);
    expect(shouldExpandTimeGroup({ editMode: false, timeOfDay: 'morning', currentTimeOfDay: 'morning', manuallyToggled: ['morning'] })).toBe(false);
    expect(shouldExpandTimeGroup({ editMode: false, timeOfDay: 'night', currentTimeOfDay: 'morning', manuallyToggled: [] })).toBe(false);
    expect(shouldExpandTimeGroup({ editMode: false, timeOfDay: 'night', currentTimeOfDay: 'morning', manuallyToggled: ['night'] })).toBe(true);
    expect(shouldExpandTimeGroup({ editMode: true, timeOfDay: 'night', currentTimeOfDay: 'morning', manuallyToggled: ['night'] })).toBe(true);
  });
});
