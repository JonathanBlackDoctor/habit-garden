import { useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import { useProgress, getGameDayKST } from '@/features/garden/useGarden';
import { useHabits, useHabitChecks } from '@/features/habits/useHabits';
import { projectTomorrowHealth, type HealthForecast } from 'shared/lib/healthForecast';
import type { ProgressDoc } from 'shared/types/firestore';

/**
 * 휴가(vacationUntil)·freeze 토큰으로 보호되는 날인지 — 스트릭과 무관하게 적용되는 보호.
 * 서버 dailyReset.isDayProtected / tryConsumeStreakProtection 의 휴가·freeze 분기를 미러.
 */
function isDayProtectedClient(prog: ProgressDoc, date: string): boolean {
  if (prog.vacationUntil && prog.vacationUntil >= date) return true;
  if (prog.freezeProtectedDate && prog.freezeProtectedDate === date) return true;
  return false;
}

/** 주의 시작(월요일) 'YYYY-MM-DD' — 서버 dailyReset.getWeekStart 와 동일 알고리즘(UTC 기준). */
function weekStartOf(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay();             // 0=일 … 6=토
  const diff = day === 0 ? -6 : 1 - day; // 월요일로 보정
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

/**
 * 실패일에 '주간 그레이스(주 1회)'로 스트릭이 보호될 수 있는 상태인가.
 * 서버 tryConsumeStreakProtection 와 동일: globalStreak>0 이고 이번 주 그레이스 미사용일 때.
 * 필요한 데이터(globalStreak·graceUsed)가 모두 클라이언트 progress 에 있어 정확히 예측 가능하다.
 * (소비는 서버가 하지만, 예보는 '이대로면' 시나리오라 가용 여부만 알면 충분하다.)
 */
function weeklyGraceProtectableClient(prog: ProgressDoc, date: string): boolean {
  if ((prog.globalStreak ?? 0) <= 0) return false;
  const weekStart = weekStartOf(date);
  const grace = prog.graceUsed;
  const usedThisWeek = grace && grace.weekStart === weekStart ? (grace.daysUsed ?? 0) : 0;
  return usedThisWeek < 1;
}

/**
 * '내일 정원 생기' 선제적 예보. 오늘 습관을 체크/해제할 때마다 실시간으로 갱신된다.
 * 과거 날짜를 보고 있을 땐(예보 의미 없음) null 을 돌려 노출하지 않는다.
 */
export function useHealthForecast(): HealthForecast | null {
  const date = useAppStore((s) => s.currentDate);
  const progress = useProgress();
  const habits = useHabits();
  const checks = useHabitChecks(date);

  return useMemo(() => {
    if (!progress) return null;
    if (date !== getGameDayKST()) return null;   // 오늘(게임일)에 대해서만 예보
    return projectTomorrowHealth({
      currentHealth: progress.gardenState?.health ?? 100,
      habits,
      checks,
      plants: progress.gardenState?.plants ?? [],
      spendablePoints: progress.spendablePoints ?? 0,
      protectedDay: isDayProtectedClient(progress, date),
      weeklyGraceProtectable: weeklyGraceProtectableClient(progress, date),
      date,
    });
  }, [progress, habits, checks, date]);
}
