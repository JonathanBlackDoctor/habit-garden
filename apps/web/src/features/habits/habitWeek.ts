import type { HabitCheckDoc, HabitDoc } from 'shared/types/firestore';
import { inHibernationWindow } from 'shared/lib/hibernation';

export type WeekChecks = Record<string, Record<string, HabitCheckDoc>>;
export type HistoricalCheck = HabitCheckDoc & { habitSnapshot?: Partial<HabitDoc> };

export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 유효한 과거/오늘 날짜만 선택할 수 있다. 미래·잘못된 날짜는 거부. */
export function isSelectableHabitDate(date: string, today: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today) return false;
  const parsed = new Date(`${date}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
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

/** 해당 날짜에 존재하던 습관과 이미 기록된 항목만 표시. 기록 시점의 설정을 우선한다. */
export function historicalHabitsForDate(
  habits: HabitDoc[],
  date: string,
  today: string,
  checks: Record<string, HabitCheckDoc>,
): HabitDoc[] {
  return habits
    .filter((habit) => cellAvailability(habit, date, today, checks[habit.id]) === 'available')
    .map((habit) => recordingHabit(habit, checks[habit.id]));
}

export function checkLabel(check?: HabitCheckDoc): string {
  if (!check) return '미기록';
  if (check.score === null) return '건너뜀';
  return check.achieved ? '달성' : '미달성';
}
