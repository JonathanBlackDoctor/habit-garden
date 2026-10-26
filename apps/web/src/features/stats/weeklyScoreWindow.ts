import { lastNDates } from '@/lib/dayBoundary';

export const MAX_SCORE_WEEKS = 520;

/** '오늘'을 기준으로 n주 전까지 연속된 7일 (오래된 날짜 → 새로운 날짜). */
export function weeklyScoreDates(today: string, weeksAgo: number): string[] {
  const last = new Date(today + 'T12:00:00Z');
  last.setUTCDate(last.getUTCDate() - Math.max(0, weeksAgo) * 7);
  return lastNDates(last.toISOString().slice(0, 10), 7);
}

export function changeScoreWeek(current: number, direction: 'older' | 'newer'): number {
  return direction === 'older'
    ? Math.min(MAX_SCORE_WEEKS, current + 1)
    : Math.max(0, current - 1);
}

/** 오른쪽으로 당기면 과거, 왼쪽으로 당기면 최신으로. 수직 스크롤은 무시한다. */
export function scoreWeekAfterDrag(current: number, dx: number, dy: number): number {
  if (Math.abs(dx) < 45 || Math.abs(dx) <= Math.abs(dy) * 1.2) return current;
  return changeScoreWeek(current, dx > 0 ? 'older' : 'newer');
}
