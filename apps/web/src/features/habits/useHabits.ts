import { useEffect, useState } from 'react';
import {
  collection, onSnapshot, query, orderBy, doc, setDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import type { HabitDoc, HabitCheckDoc } from 'shared/types/firestore';
import { toast } from 'sonner';

export function useHabits() {
  const uid  = useAppStore((s) => s.uid);
  const [habits, setHabits] = useState<HabitDoc[]>([]);

  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, 'users', uid, 'habits'), orderBy('order'));
    return onSnapshot(q, (snap) => {
      setHabits(snap.docs.map((d) => d.data() as HabitDoc).filter((h) => h.active));
    });
  }, [uid]);

  return habits;
}

export function useHabitChecks(date: string) {
  const uid  = useAppStore((s) => s.uid);
  const [checks, setChecks] = useState<Record<string, HabitCheckDoc>>({});

  useEffect(() => {
    if (!uid) return;
    const q = collection(db, 'users', uid, 'days', date, 'habitChecks');
    return onSnapshot(q, (snap) => {
      const map: Record<string, HabitCheckDoc> = {};
      snap.docs.forEach((d) => { map[d.id] = d.data() as HabitCheckDoc; });
      setChecks(map);
    });
  }, [uid, date]);

  return checks;
}

export function useSaveHabitCheck() {
  const uid  = useAppStore((s) => s.uid);
  const date = useAppStore((s) => s.currentDate);

  return async (habit: HabitDoc, score: number | null) => {
    if (!uid) return;
    const achieved = score !== null && score >= habit.achieveThreshold;
    const check: HabitCheckDoc = {
      habitId: habit.id,
      score,
      achieved,
      checkedAt: serverTimestamp() as any,
    };
    await setDoc(
      doc(db, 'users', uid, 'days', date, 'habitChecks', habit.id),
      check
    );
    // 포인트 토스트는 awardEngine에서 처리. 클라이언트에서 간단히 알림.
    if (achieved) {
      const pts = habit.weight * 2 + (habit.scoreMode === 'scaled' && score === 5 ? 5 : 0);
      toast(`✦ +${pts}P`, { description: `${habit.title} 달성` });
    }
  };
}
