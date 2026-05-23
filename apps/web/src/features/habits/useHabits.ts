import { useEffect, useState } from 'react';
import {
  collection, onSnapshot, query, orderBy, doc, setDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import type { HabitDoc, HabitCheckDoc } from 'shared/types/firestore';
import { pointsForCheck } from 'shared/lib/habitPoints';
import { toast } from 'sonner';
import { feedback } from '@/lib/feedback';

export function useHabits(opts?: { includeInactive?: boolean }) {
  const uid  = useAppStore((s) => s.uid);
  const includeInactive = opts?.includeInactive ?? false;
  const [habits, setHabits] = useState<HabitDoc[]>([]);

  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, 'users', uid, 'habits'), orderBy('order'));
    return onSnapshot(q, (snap) => {
      const all = snap.docs.map((d) => d.data() as HabitDoc);
      setHabits(includeInactive ? all : all.filter((h) => h.active));
    });
  }, [uid, includeInactive]);

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

export function useSaveHabitCheck(dateOverride?: string) {
  const uid  = useAppStore((s) => s.uid);
  const storeDate = useAppStore((s) => s.currentDate);
  const date = dateOverride ?? storeDate;
  const isPastEdit = !!dateOverride && dateOverride !== storeDate;

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

    if (isPastEdit) {
      // 과거 날짜 편집은 토스트만 — 콤보·셀러브레이션은 오늘 한정
      if (score === null) {
        toast(`${habit.title} 기록 삭제됨`);
      } else {
        toast(`${habit.title} 저장됨`, {
          description: `${date} · ${achieved ? '달성' : '시도'}`,
        });
      }
      return;
    }

    const { bumpCombo, resetCombo, triggerCelebration } = useAppStore.getState();

    if (score === null) {
      // pass — 콤보 끊김
      resetCombo();
      return;
    }

    const perfect = habit.scoreMode === 'scaled' && score === 5;
    const basePts = pointsForCheck(habit.weight, habit.scoreMode, score);

    if (achieved) {
      const combo = bumpCombo();
      const comboBonus = combo >= 3 ? combo : 0;
      const totalPts = basePts + comboBonus;

      feedback(perfect ? 'perfect' : 'achieve');
      if (combo >= 3) feedback('combo');

      toast(`✦ +${totalPts}P`, {
        description:
          comboBonus > 0
            ? `${habit.title} 달성 · 🔥${combo} 콤보 +${comboBonus}`
            : `${habit.title} 달성`,
      });

      if (perfect) {
        triggerCelebration('perfect', {
          title: habit.title,
          points: totalPts,
          detail: comboBonus > 0 ? `🔥 ${combo} 콤보` : undefined,
        });
      }
    } else {
      // 부분 점수 — 작은 토스트, 콤보는 끊지 않음
      feedback('check');
      if (basePts > 0) {
        toast(`✦ +${basePts}P`, { description: `${habit.title} · 시도 인정` });
      }
    }
  };
}
