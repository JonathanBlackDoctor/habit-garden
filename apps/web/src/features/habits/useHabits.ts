import { useEffect, useState } from 'react';
import {
  collection, onSnapshot, query, orderBy, doc, setDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import type { HabitDoc, HabitCheckDoc } from 'shared/types/firestore';
import { SCALED_ACHIEVE_THRESHOLD } from 'shared/lib/habitPoints';
import { isHibernating } from 'shared/lib/hibernation';
import { toast } from 'sonner';
import { feedback } from '@/lib/feedback';

export function useHabits(opts?: { includeInactive?: boolean; includeHibernating?: boolean }) {
  const uid  = useAppStore((s) => s.uid);
  const includeInactive = opts?.includeInactive ?? false;
  // 휴면(잠재운) 습관은 active:true 를 유지하므로 기본 목록에서 명시적으로 제외한다.
  // 제외하지 않으면 '오늘의 습관' 위젯 등에서 체크 문서가 없어 미체크로 잘못 집계된다.
  // 휴면 습관까지 다뤄야 하는 화면(습관 관리)만 includeHibernating 으로 포함한다.
  const includeHibernating = opts?.includeHibernating ?? false;
  const [habits, setHabits] = useState<HabitDoc[]>([]);

  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, 'users', uid, 'habits'), orderBy('order'));
    return onSnapshot(q, (snap) => {
      const all = snap.docs.map((d) => d.data() as HabitDoc);
      setHabits(all.filter((h) =>
        (includeInactive || h.active) &&
        (includeHibernating || !isHibernating(h)),
      ));
    });
  }, [uid, includeInactive, includeHibernating]);

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

/**
 * 체크 문서를 삭제해 '미기록' 상태로 되돌린다.
 * 건너뜀(score=null) 취소 등에 사용.
 */
export function useClearHabitCheck(dateOverride?: string) {
  const uid  = useAppStore((s) => s.uid);
  const storeDate = useAppStore((s) => s.currentDate);
  const date = dateOverride ?? storeDate;
  const isPastEdit = !!dateOverride && dateOverride !== storeDate;

  return async (habit: HabitDoc, prevCheck?: HabitCheckDoc | null) => {
    if (!uid || prevCheck == null) return;
    await deleteDoc(doc(db, 'users', uid, 'days', date, 'habitChecks', habit.id));
    feedback('check');
    toast(isPastEdit ? '기록 삭제됨' : '건너뜀 취소됨', { description: habit.title });
  };
}

export function useSaveHabitCheck(dateOverride?: string) {
  const uid  = useAppStore((s) => s.uid);
  const storeDate = useAppStore((s) => s.currentDate);
  const date = dateOverride ?? storeDate;
  const isPastEdit = !!dateOverride && dateOverride !== storeDate;

  return async (
    habit: HabitDoc,
    score: number | null,
    prevCheck?: HabitCheckDoc | null,
  ) => {
    if (!uid) return;

    const prevScore = prevCheck?.score ?? null;

    // 같은 상태 재클릭: no-op. 단, 기록이 이미 있을 때만 —
    // 미기록(prevCheck 없음)에서 건너뛰기(score=null)는 새 기록으로 저장돼야 함
    if (prevCheck != null && prevScore === score) return;

    const threshold = habit.scoreMode === 'scaled' ? SCALED_ACHIEVE_THRESHOLD : habit.achieveThreshold;
    const achieved = score !== null && score >= threshold;
    const checkDoc: HabitCheckDoc = {
      habitId: habit.id,
      score,
      achieved,
      checkedAt: serverTimestamp() as any,
    };
    await setDoc(
      doc(db, 'users', uid, 'days', date, 'habitChecks', habit.id),
      checkDoc
    );

    if (isPastEdit) {
      if (score === null) {
        toast(`${habit.title} 기록 삭제됨`);
      } else {
        toast(`${habit.title} 저장됨`, {
          description: `${date} · ${achieved ? '달성' : '시도'}`,
        });
      }
      return;
    }

    if (score === null) {
      feedback('check');
      toast('건너뜀', { description: habit.title });
      return;
    }

    if (achieved) {
      feedback('achieve');
      toast('달성!', { description: habit.title });
    } else {
      feedback('check');
      toast('기록됨', { description: `${habit.title} · 시도 인정` });
    }
  };
}
