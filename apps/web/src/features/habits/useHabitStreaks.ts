import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import type { HabitCheckDoc } from 'shared/types/firestore';

/**
 * 습관별 '오늘 직전까지의 연속 달성일' 맵을 계산한다.
 * 최근 N일 day 문서의 habitChecks 를 1회 getDocs(리스너 아님)로 병렬 조회.
 * 어제부터 거꾸로 연속 achieved 인 날을 세어 스트릭 위험 경고에 사용.
 * 건너뜀(score=null)인 날은 스트릭을 끊지 않고 중립으로 통과(카운트는 안 함).
 *
 * Tradeoff: N일 범위 밖 스트릭은 N으로 캡되지만 경고 용도엔 충분.
 */
export function useHabitStreaks(days = 14): Record<string, number> {
  const uid = useAppStore((s) => s.uid);
  const today = useAppStore((s) => s.currentDate);
  const [streaks, setStreaks] = useState<Record<string, number>>({});

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
      const statusByDay: Record<string, 'achieved' | 'skipped'>[] = snaps.map((snap) => {
        const m: Record<string, 'achieved' | 'skipped'> = {};
        snap.docs.forEach((doc) => {
          const c = doc.data() as HabitCheckDoc;
          if (c.achieved === true) m[doc.id] = 'achieved';
          else if (c.score === null) m[doc.id] = 'skipped';
        });
        return m;
      });

      const result: Record<string, number> = {};
      const habitIds = new Set<string>();
      statusByDay.forEach((m) => Object.keys(m).forEach((id) => habitIds.add(id)));

      for (const id of habitIds) {
        let streak = 0;
        for (const day of statusByDay) {
          const st = day[id];
          if (st === 'achieved') streak++;
          else if (st === 'skipped') continue; // 중립 — 끊지 않음
          else break;                          // 미기록·미달 — 스트릭 종료
        }
        if (streak > 0) result[id] = streak;
      }
      setStreaks(result);
    })();

    return () => { cancelled = true; };
  }, [uid, today, days]);

  return streaks;
}
