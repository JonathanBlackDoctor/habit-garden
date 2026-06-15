import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import type { ConditionData, DayDoc } from 'shared/types/firestore';

export interface ConditionDay {
  date: string;
  condition: ConditionData;
  dayScore?: number;
}

/** 'YYYY-MM-DD' 에서 days 만큼 이전 날짜 문자열. */
function shiftDate(date: string, days: number): string {
  const d = new Date(date + 'T04:00:00+09:00');
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * 최근 `windowDays` 일치의 일일 문서를 구독해, 컨디션이 하나라도 기록된 날만
 * 최신순으로 돌려준다. 컨디션 분석(평균·추세·상관)의 입력으로 쓴다.
 */
export function useConditionHistory(windowDays = 35): ConditionDay[] {
  const uid = useAppStore((s) => s.uid);
  const today = useAppStore((s) => s.currentDate);
  const cutoff = useMemo(() => shiftDate(today, windowDays), [today, windowDays]);
  const [days, setDays] = useState<ConditionDay[]>([]);

  useEffect(() => {
    if (!uid) { setDays([]); return; }
    // date 필드 단일 범위 쿼리 — 복합 인덱스가 필요 없다(본인 소유 경로).
    const q = query(collection(db, 'users', uid, 'days'), where('date', '>=', cutoff));
    return onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs
          .map((d) => d.data() as DayDoc)
          .filter((d) => hasAnyCondition(d.condition))
          .map((d) => ({ date: d.date, condition: d.condition, dayScore: d.dayScore }))
          .sort((a, b) => (a.date > b.date ? -1 : 1));
        setDays(rows);
      },
      () => setDays([]),
    );
  }, [uid, cutoff]);

  return days;
}

function hasAnyCondition(c?: ConditionData): c is ConditionData {
  if (!c) return false;
  return (
    c.sleepScore !== undefined ||
    c.energyScore !== undefined ||
    c.moodScore !== undefined ||
    !!c.bedTime ||
    !!c.wakeTime
  );
}
