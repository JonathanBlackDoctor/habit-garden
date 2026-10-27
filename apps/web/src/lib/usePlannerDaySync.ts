import { useEffect } from 'react';
import { nextPlannerDayBoundary, plannerDate } from '@/lib/dayBoundary';
import { useAppStore } from '@/lib/store';

/**
 * PWA가 켜져 있는 동안 매일 04:00 KST에 플래너 날짜를 자동 전환한다.
 * 모바일 OS가 백그라운드 타이머를 중지할 수 있으므로 화면 복귀 시에도 다시 확인한다.
 */
export function usePlannerDaySync() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const syncDate = () => {
      const now = new Date();
      const nextDate = plannerDate(now);
      const store = useAppStore.getState();
      if (store.currentDate !== nextDate) store.setCurrentDate(nextDate);

      // 경계에서는 곧바로, 그 외에는 최대 1분마다 시간대/시계 변경까지 확인.
      // +150ms는 04:00 직전 타이머가 일찍 깨는 경우의 조기 실행을 방지한다.
      if (timer !== undefined) clearTimeout(timer);
      const untilBoundary = nextPlannerDayBoundary(now).getTime() - now.getTime();
      timer = setTimeout(syncDate, Math.max(150, Math.min(60_000, untilBoundary + 150)));
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') syncDate();
    };

    syncDate(); // 앱이 늦게 재개되었거나 이전 날짜를 유지하고 있으면 즉시 보정
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', syncDate);
    window.addEventListener('pageshow', syncDate); // PWA / BFCache 복구
    return () => {
      if (timer !== undefined) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', syncDate);
      window.removeEventListener('pageshow', syncDate);
    };
  }, []);
}
