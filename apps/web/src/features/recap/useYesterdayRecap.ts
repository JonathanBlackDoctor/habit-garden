import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import type { DayDoc, HabitCheckDoc, HabitDoc } from 'shared/types/firestore';
import { buildYesterdayRecap, type YesterdayRecap } from './yesterdayRecap';

/** YYYY-MM-DD 문자열의 전날 키 */
export function prevDateKey(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * 어제 돌아보기 — 어제의 habitChecks·dayScore 를 1회 조회(리스너 아님)해
 * 다음날 메인에서 보여줄 피드백 요약을 만든다.
 * 다른 위젯처럼 닫기 없이 항상 노출(보여줄 내용이 있을 때).
 */
export function useYesterdayRecap(habits: HabitDoc[]) {
  const uid = useAppStore((s) => s.uid);
  const today = useAppStore((s) => s.currentDate);
  const yesterday = prevDateKey(today);

  const [checks, setChecks] = useState<Record<string, HabitCheckDoc> | null>(null);
  const [dayScore, setDayScore] = useState<number | undefined>(undefined);
  const [penalty, setPenalty] = useState<{ points: number; healthLoss: number; count: number } | null>(null);
  // 어제 회고의 '내일 딱 한 가지 더 잘하고 싶은 것(q_tomorrow)' — 오늘 실천할 다짐
  const [resolution, setResolution] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    (async () => {
      const [checkSnap, daySnap] = await Promise.all([
        getDocs(collection(db, 'users', uid, 'days', yesterday, 'habitChecks')),
        getDoc(doc(db, 'users', uid, 'days', yesterday)),
      ]);
      if (cancelled) return;
      const map: Record<string, HabitCheckDoc> = {};
      checkSnap.docs.forEach((d) => { map[d.id] = d.data() as HabitCheckDoc; });
      setChecks(map);
      const day = daySnap.exists() ? (daySnap.data() as DayDoc) : null;
      setDayScore(day?.dayScore);
      setResolution(day?.reflection?.answers?.q_tomorrow?.trim() || undefined);
      setPenalty(
        day?.penaltyApplied && ((day.penaltyPoints ?? 0) > 0 || (day.penaltyHealthLoss ?? 0) > 0)
          ? { points: day.penaltyPoints ?? 0, healthLoss: day.penaltyHealthLoss ?? 0, count: day.penaltyCount ?? 0 }
          : null,
      );
    })();
    return () => { cancelled = true; };
  }, [uid, yesterday]);

  const recap: YesterdayRecap | null = useMemo(
    () => (checks ? buildYesterdayRecap(habits, checks) : null),
    [habits, checks],
  );

  return {
    recap,
    dayScore,
    penalty,
    yesterday,
    resolution,
    // 보여줄 내용(어제 요약 또는 어제의 다짐)이 있을 때 노출 — 닫기 없이 항상 유지
    visible: recap !== null || resolution !== undefined,
  };
}
