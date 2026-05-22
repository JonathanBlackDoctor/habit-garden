import {
  doc, getDoc, setDoc, serverTimestamp, Timestamp,
  collection, onSnapshot,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import type { DailyReflectionDoc } from 'shared/types/firestore';

/**
 * 한 줄 회고 저장 — users/{uid}/reflections/{date} 의 entries 배열에 push.
 * 이미 같은 habitId 항목이 있으면 덮어쓴다.
 * 동시에 habitCheckDoc 의 mood/note 도 갱신해 카드에서 다시 입력창이 뜨지 않게 한다.
 */
export function useSaveReflection() {
  const uid  = useAppStore((s) => s.uid);
  const date = useAppStore((s) => s.currentDate);

  return async (habitId: string, payload: { mood: 1 | 2 | 3 | 4 | 5; note?: string }) => {
    if (!uid) return;
    const ref = doc(db, 'users', uid, 'reflections', date);
    const snap = await getDoc(ref);
    const existing = snap.exists() ? (snap.data() as DailyReflectionDoc) : null;
    const entries = existing?.entries ? [...existing.entries] : [];
    const idx = entries.findIndex((e) => e.habitId === habitId);
    const entry = {
      habitId,
      mood: payload.mood,
      note: payload.note,
      at: Timestamp.now(),
    };
    if (idx >= 0) entries[idx] = entry;
    else entries.push(entry);
    await setDoc(
      ref,
      { date, entries, updatedAt: serverTimestamp() as any },
      { merge: true },
    );

    // habitCheck 에도 mood/note 머지 — 카드 재오픈 방지
    const checkRef = doc(db, 'users', uid, 'days', date, 'habitChecks', habitId);
    await setDoc(
      checkRef,
      { mood: payload.mood, ...(payload.note ? { note: payload.note } : {}) },
      { merge: true },
    );
  };
}

/** 오늘자 회고 entries 실시간 구독. 통계/AI 코치 입력용. */
export function useTodayReflection(date: string) {
  const uid = useAppStore((s) => s.uid);
  const [data, setData] = useState<DailyReflectionDoc | null>(null);

  useEffect(() => {
    if (!uid) return;
    const ref = doc(db, 'users', uid, 'reflections', date);
    return onSnapshot(ref, (snap) => {
      setData(snap.exists() ? (snap.data() as DailyReflectionDoc) : null);
    });
  }, [uid, date]);

  return data;
}

/** 최근 N일 회고 구독. AI 코치 컨텍스트용. */
export function useRecentReflections(days = 14) {
  const uid = useAppStore((s) => s.uid);
  const [items, setItems] = useState<DailyReflectionDoc[]>([]);

  useEffect(() => {
    if (!uid) return;
    const col = collection(db, 'users', uid, 'reflections');
    return onSnapshot(col, (snap) => {
      const all = snap.docs
        .map((d) => d.data() as DailyReflectionDoc)
        .sort((a, b) => (a.date > b.date ? -1 : 1))
        .slice(0, days);
      setItems(all);
    });
  }, [uid, days]);

  return items;
}
