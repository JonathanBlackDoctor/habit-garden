import { useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import { useProgress, getGameDayKST } from '@/features/garden/useGarden';
import { useHabits, useHabitChecks } from '@/features/habits/useHabits';
import { projectTomorrowHealth, type HealthForecast } from 'shared/lib/healthForecast';
import type { ProgressDoc } from 'shared/types/firestore';

/**
 * 소모 없이 해당 날짜가 보호되는지만 판단 — 서버 dailyReset.isDayProtected 의 보수적 미러.
 * 그레이스(주 1회)는 소비가 서버측이라 클라이언트에서 확신할 수 없으므로, over-promise 를
 * 피하기 위해 휴가(vacationUntil)·freeze 토큰만 보호로 인정한다.
 */
function isDayProtectedClient(prog: ProgressDoc, date: string): boolean {
  if (prog.vacationUntil && prog.vacationUntil >= date) return true;
  if (prog.freezeProtectedDate && prog.freezeProtectedDate === date) return true;
  return false;
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
      date,
    });
  }, [progress, habits, checks, date]);
}
