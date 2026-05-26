import type { HabitCheckDoc } from 'shared/types/firestore';

export type HabitStatus = 'achieved' | 'missed' | 'skipped' | 'todo';

/** 오늘의 체크 문서로부터 습관 상태를 판정한다. */
export function statusOf(check?: HabitCheckDoc): HabitStatus {
  if (check === undefined) return 'todo';
  if (check.achieved) return 'achieved';
  if (check.score === null) return 'skipped';
  return 'missed';
}
