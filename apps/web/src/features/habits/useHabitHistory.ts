import { useEffect, useState } from 'react';
import { collectionGroup, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import type { HabitCheckDoc } from 'shared/types/firestore';

/**
 * 한 습관의 최근 N일 체크 이력을 구독.
 * collectionGroup 인덱스 필요: 'habitChecks' + habitId.
 * 인덱스가 없을 경우 콘솔 오류 발생, 빈 배열 반환.
 */
export function useHabitHistory(habitId: string, days = 30) {
  const uid = useAppStore((s) => s.uid);
  const today = useAppStore((s) => s.currentDate);
  const [history, setHistory] = useState<Record<string, HabitCheckDoc>>({});

  useEffect(() => {
    if (!uid || !habitId) return;
    // collectionGroup 으로 모든 날의 habitChecks 중 해당 habitId 만 필터
    const q = query(
      collectionGroup(db, 'habitChecks'),
      where('habitId', '==', habitId),
    );
    return onSnapshot(
      q,
      (snap) => {
        const map: Record<string, HabitCheckDoc> = {};
        snap.docs.forEach((d) => {
          // 경로: users/{uid}/days/{date}/habitChecks/{habitId}
          const parts = d.ref.path.split('/');
          const idx = parts.indexOf('days');
          if (idx === -1 || parts[1] !== uid) return;
          const date = parts[idx + 1];
          map[date] = d.data() as HabitCheckDoc;
        });
        setHistory(map);
      },
      () => setHistory({}),
    );
  }, [uid, habitId]);

  // 최근 N일 키 배열 생성
  const dates: string[] = [];
  const t = new Date(today);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(t);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return { dates, history };
}
