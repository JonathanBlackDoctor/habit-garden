import { useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, functions } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import { useIsPremium } from '@/lib/features';

type Mode = 'daily' | 'crisis' | 'weekly';

export interface DailyCoach { message: string; tone?: string }
export interface WeeklyCoach { strengths: string; pattern: string; recommendation: string }

/** Phase 3-3 — 오늘의 격려. 진입 시 1회 호출, 캐시는 함수가 처리. */
export function useDailyCoach() {
  const uid = useAppStore((s) => s.uid);
  const today = useAppStore((s) => s.currentDate);
  const isPremium = useIsPremium();
  const [data, setData] = useState<DailyCoach | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 캐시 구독
  useEffect(() => {
    if (!uid || !isPremium) return;
    return onSnapshot(doc(db, 'users', uid, 'coach', `${today}_daily`), (snap) => {
      if (snap.exists()) setData(snap.data() as DailyCoach);
    });
  }, [uid, today, isPremium]);

  // 캐시 없으면 호출 (승인 사용자만)
  useEffect(() => {
    if (!uid || !isPremium || data || loading) return;
    setLoading(true);
    callCoach('daily')
      .then((r) => setData(r as DailyCoach))
      .catch((e) => setError(e?.message ?? 'error'))
      .finally(() => setLoading(false));
  }, [uid, isPremium, data, loading]);

  return { data, loading, error };
}

/** Phase 3-5 — 주간 인사이트. lazy: 사용자가 카드 펼칠 때 fetch. */
export function useWeeklyCoach() {
  const uid = useAppStore((s) => s.uid);
  const today = useAppStore((s) => s.currentDate);
  const isPremium = useIsPremium();
  const [data, setData] = useState<WeeklyCoach | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!uid || !isPremium) return;
    return onSnapshot(doc(db, 'users', uid, 'coach', `${today}_weekly`), (snap) => {
      if (snap.exists()) setData(snap.data() as WeeklyCoach);
    });
  }, [uid, today, isPremium]);

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await callCoach('weekly');
      setData(r as WeeklyCoach);
    } finally {
      setLoading(false);
    }
  };
  return { data, loading, refresh };
}

/** Phase 3-4 — 위기 개입. 트리거 조건 만족 시 호출. */
export async function fetchCrisisCoach(): Promise<DailyCoach> {
  return (await callCoach('crisis')) as DailyCoach;
}

async function callCoach(mode: Mode) {
  const fn = httpsCallable(functions, 'aiCoach');
  const res = await fn({ mode });
  return res.data;
}
