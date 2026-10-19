import type { HabitCheckDoc, HabitDoc } from 'shared/types/firestore';
import { inHibernationWindow } from 'shared/lib/hibernation';

export type WeekChecks = Record<string, Record<string, HabitCheckDoc>>;
export type HistoricalCheck = HabitCheckDoc & { habitSnapshot?: Partial<HabitDoc> };

export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function weekDates(date: string, offset = 0): string[] {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const monday = shiftDate(date, -(weekday === 0 ? 6 : weekday - 1) + offset * 7);
  return Array.from({ length: 7 }, (_, i) => shiftDate(monday, i));
}

export function recordingHabit(habit: HabitDoc, check?: HabitCheckDoc): HabitDoc {
  const snapshot = (check as HistoricalCheck | undefined)?.habitSnapshot;
  return snapshot ? { ...habit, ...snapshot, id: habit.id } : habit;
}

export function cellAvailability(habit: HabitDoc, date: string, today: string, check?: HabitCheckDoc) {
  if (date > today) return 'future';
  if (check) return 'available';
  if (habit.startedOn && date < habit.startedOn) return 'before-start';
  if (inHibernationWindow(habit, date, today)) return 'rest';
  if (!habit.active || habit.archivedAt) return 'inactive';
  return 'available';
}

export function weekSummary(habits: HabitDoc[], dates: string[], checks: WeekChecks, today: string) {
  let total = 0, achieved = 0, recorded = 0, skipped = 0;
  for (const habit of habits) {
    for (const date of dates) {
      const check = checks[date]?.[habit.id];
      if (cellAvailability(habit, date, today, check) !== 'available') continue;
      total++;
      if (!check) continue;
      recorded++;
      if (check.score === null) skipped++;
      else if (check.achieved) achieved++;
    }
  }
  const target = total - skipped;
  return { total, achieved, recorded, skipped, target, rate: target ? Math.round(achieved / target * 100) : null };
}

export function checkLabel(check?: HabitCheckDoc): string {
  if (!check) return '미기록';
  if (check.score === null) return '건너뜀';
  return check.achieved ? '달성' : '미달성';
}
