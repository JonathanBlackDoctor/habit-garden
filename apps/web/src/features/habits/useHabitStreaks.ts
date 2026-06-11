import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import type { HabitCheckDoc, HabitDoc } from 'shared/types/firestore';
import { SCALED_ACHIEVE_THRESHOLD } from 'shared/lib/habitPoints';
import { inHibernationWindow } from 'shared/lib/hibernation';

/**
 * 습관별 '오늘 직전까지의 연속 달성일' 맵을 계산한다.
 * 최근 N일 day 문서의 habitChecks 를 1회 getDocs(리스너 아님)로 병렬 조회.
 * 어제부터 거꾸로 연속 달성한 날을 세어 스트릭 위험 경고에 사용.
 * 건너뜀(score=null)인 날은 스트릭을 끊지 않고 중립으로 통과(카운트는 안 함).
 *
 * 달성 여부는 저장된 achieved 필드가 아니라 점수에서 현재 임계값으로 재계산한다
 * — 과거에 잘못된 임계값으로 굳은 achieved=true 를 무시하고 항상 정합하도록.
 *
 * Tradeoff: N일 범위 밖 스트릭은 N으로 캡되지만 경고 용도엔 충분.
 */
export function useHabitStreaks(habits: HabitDoc[], days = 14): Record<string, number> {
  const uid = useAppStore((s) => s.uid);
  const today = useAppStore((s) => s.currentDate);
  const [streaks, setStreaks] = useState<Record<string, number>>({});

  // habitId → 달성 임계값 (scaled는 획일적으로 3, binary는 1)
  // 휴면 구간(since/until)도 키에 포함 — 깨우면 스트릭이 즉시 재계산되도록.
  const thresholdKey = habits
    .map((h) => `${h.id}:${h.scoreMode}:${h.achieveThreshold}:${h.hibernatedSince ?? ''}:${h.hibernatedUntil ?? ''}`)
    .join(',');
  const thresholds = useMemo(() => {
    const m: Record<string, number> = {};
    for (const h of habits) {
      m[h.id] = h.scoreMode === 'scaled' ? SCALED_ACHIEVE_THRESHOLD : h.achieveThreshold;
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thresholdKey]);

  // habitId → 휴면 구간(since/until). 스트릭 브리지에 사용 (thresholds와 동일하게 키로 안정화).
  const hibernation = useMemo(() => {
    const m: Record<string, Pick<HabitDoc, 'hibernatedSince' | 'hibernatedUntil'>> = {};
    for (const h of habits) m[h.id] = { hibernatedSince: h.hibernatedSince, hibernatedUntil: h.hibernatedUntil };
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thresholdKey]);

  useEffect(() => {
    if (!uid || !today) return;
    let cancelled = false;

    // 어제부터 거꾸로 N개의 날짜 키 생성 (오늘 제외)
    const dateKeys: string[] = [];
    const base = new Date(today + 'T00:00:00Z');
    for (let i = 1; i <= days; i++) {
      const d = new Date(base);
      d.setUTCDate(d.getUTCDate() - i);
      dateKeys.push(d.toISOString().slice(0, 10));
    }

    (async () => {
      const snaps = await Promise.all(
        dateKeys.map((date) =>
          getDocs(collection(db, 'users', uid, 'days', date, 'habitChecks')),
        ),
      );
      if (cancelled) return;

      // dateKeys[i] (어제=0, 그제=1 ...) 에 대한 habitId→상태 맵
      // 'achieved' = 달성 / 'skipped' = 건너뜀(중립) / 없음 = 미기록·미달(스트릭 끊김)
      // 달성 판정은 저장된 achieved 가 아니라 점수 ≥ 현재 임계값으로 재계산한다.
      const statusByDay: Record<string, 'achieved' | 'skipped'>[] = snaps.map((snap) => {
        const m: Record<string, 'achieved' | 'skipped'> = {};
        snap.docs.forEach((doc) => {
          const c = doc.data() as HabitCheckDoc;
          if (c.score === null) m[doc.id] = 'skipped';
          else if (c.score >= (thresholds[doc.id] ?? Infinity)) m[doc.id] = 'achieved';
        });
        return m;
      });

      const result: Record<string, number> = {};
      const habitIds = new Set<string>();
      statusByDay.forEach((m) => Object.keys(m).forEach((id) => habitIds.add(id)));
      for (const id of habitIds) {
        const hib = hibernation[id];
        let streak = 0;
        for (let i = 0; i < statusByDay.length; i++) {
          const st = statusByDay[i][id];
          if (st === 'achieved') streak++;
          else if (st === 'skipped') continue; // 중립 — 끊지 않음
          // 미기록이지만 그 날이 휴면 구간이면 중립으로 통과(스트릭 보존).
          // 단, 룩백은 14일 한정 — 14일보다 긴 휴면은 윈도 전체가 중립이 되어
          // 복귀 시 스트릭이 0으로 보이되 '끊김/실패'로 표시되지는 않는다.
          else if (hib && inHibernationWindow(hib, dateKeys[i], today)) continue;
          else break;                          // 미기록·미달 — 스트릭 종료
        }
        if (streak > 0) result[id] = streak;
      }
      setStreaks(result);
    })();

    return () => { cancelled = true; };
  }, [uid, today, days, thresholds, hibernation]);

  return streaks;
}
