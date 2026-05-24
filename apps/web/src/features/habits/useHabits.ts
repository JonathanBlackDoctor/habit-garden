import { useEffect, useRef, useState } from 'react';
import {
  collection, onSnapshot, query, orderBy, doc, setDoc, serverTimestamp, limit,
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

/**
 * 서버(awardEngine)가 pointLedger에 기록한 실제 적립 결과를 구독해 토스트로 표시.
 * 클라이언트 추정치(델타 계산) 대신 서버 확정값을 사용하므로
 * Comeback Mode 배수, 일일 상한 등이 모두 정확하게 반영된다.
 */
export function useAwardToast(habits: HabitDoc[]) {
  const uid = useAppStore((s) => s.uid);

  // 구독이 재설정되지 않도록 habits 맵을 ref로 관리
  const habitsMapRef = useRef<Record<string, HabitDoc>>({});
  useEffect(() => {
    const m: Record<string, HabitDoc> = {};
    habits.forEach((h) => { m[h.id] = h; });
    habitsMapRef.current = m;
  }, [habits]);

  useEffect(() => {
    if (!uid) return;

    const seenIds = new Set<string>();
    let initialized = false;

    const q = query(
      collection(db, 'users', uid, 'pointLedger'),
      orderBy('createdAt', 'desc'),
      limit(5),
    );

    return onSnapshot(q, (snap) => {
      if (!initialized) {
        // 초기 스냅샷: 기존 항목은 seen 처리만 (토스트 없음)
        snap.docs.forEach((d) => seenIds.add(d.id));
        initialized = true;
        return;
      }

      snap.docChanges().forEach((change) => {
        if (change.type !== 'added') return;
        if (seenIds.has(change.doc.id)) return;
        seenIds.add(change.doc.id);

        const { delta, reason, refId } = change.doc.data() as {
          delta: number;
          reason: string;
          refId?: string;
        };

        const habitReasons = [
          'habit_achieved', 'habit_partial',
          'habit_achieved_comeback', 'habit_partial_comeback',
        ];
        if (!habitReasons.includes(reason)) return;
        if (!delta || delta <= 0) return;

        const habit = refId ? habitsMapRef.current[refId] : undefined;
        const title = habit?.title ?? '습관';
        const isAchieved = reason.includes('achieved');

        toast(`✦ +${delta}P`, {
          description: isAchieved ? `${title} 달성` : `${title} · 시도 인정`,
        });
      });
    });
  }, [uid]);
}

export function useSaveHabitCheck(dateOverride?: string) {
  const uid  = useAppStore((s) => s.uid);
  const storeDate = useAppStore((s) => s.currentDate);
  const date = dateOverride ?? storeDate;
  const isPastEdit = !!dateOverride && dateOverride !== storeDate;

  return async (habit: HabitDoc, score: number | null, prevCheck?: HabitCheckDoc | null) => {
    if (!uid) return;

    const prevScore = prevCheck?.score ?? null;

    // 같은 점수 재클릭: no-op
    if (prevScore === score) return;

    const achieved = score !== null && score >= habit.achieveThreshold;
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

    // 오늘 처음 실제 점수를 입력하는 경우만 콤보 카운트
    const isFirstCheck = prevScore === null;
    const perfect = habit.scoreMode === 'scaled' && score === 5;

    if (achieved) {
      let combo = 0;
      if (isFirstCheck) {
        combo = bumpCombo();
      }

      feedback(perfect ? 'perfect' : 'achieve');
      if (isFirstCheck && combo >= 3) feedback('combo');

      // 포인트 토스트는 useAwardToast가 서버 확정값으로 표시
      // celebration overlay는 즉각 피드백용으로 클라이언트에서 발동
      if (perfect && isFirstCheck) {
        const basePts = pointsForCheck(habit.weight, habit.scoreMode, score);
        triggerCelebration('perfect', {
          title: habit.title,
          points: basePts,
        });
      }
    } else {
      // 부분 점수 — 소리만, 포인트 토스트는 useAwardToast가 처리
      feedback('check');
    }
  };
}
