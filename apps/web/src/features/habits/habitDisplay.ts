import type { HabitCheckDoc, HabitDoc } from 'shared/types/firestore';

export const HABIT_TIME_ORDER: HabitDoc['timeOfDay'][] = [
  'morning',
  'afternoon',
  'evening',
  'night',
  'anytime',
];

type DisplayHabit = Pick<HabitDoc, 'id' | 'active' | 'timeOfDay'>;
type DisplayCheck = Pick<HabitCheckDoc, 'achieved' | 'score'>;

export function groupHabitsByTime<T extends DisplayHabit>(habits: T[]) {
  return habits.reduce<Partial<Record<HabitDoc['timeOfDay'], T[]>>>((groups, habit) => {
    (groups[habit.timeOfDay] ??= []).push(habit);
    return groups;
  }, {});
}

export function getHabitOverview(
  habits: DisplayHabit[],
  checks: Record<string, DisplayCheck | undefined>,
) {
  const active = habits.filter((habit) => habit.active);
  const total = active.length;
  const achieved = active.filter((habit) => checks[habit.id]?.achieved === true).length;
  const recorded = active.filter((habit) => checks[habit.id] !== undefined).length;

  return {
    total,
    achieved,
    recorded,
    remaining: total - recorded,
    achievementRate: total === 0 ? 0 : achieved / total,
    recordRate: total === 0 ? 0 : recorded / total,
  };
}

export function shouldExpandTimeGroup({
  editMode,
  timeOfDay,
  currentTimeOfDay,
  manuallyOpened,
}: {
  editMode: boolean;
  timeOfDay: HabitDoc['timeOfDay'];
  currentTimeOfDay: HabitDoc['timeOfDay'];
  manuallyOpened: readonly string[];
}) {
  return editMode || timeOfDay === currentTimeOfDay || manuallyOpened.includes(timeOfDay);
}
