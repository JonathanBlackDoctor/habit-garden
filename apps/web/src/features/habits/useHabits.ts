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

  return async (habit: HabitDoc, score: number | null, prevCheck?: HabitCheckDoc | null) => {
    if (!uid) return;

    const prevScore = prevCheck?.score ?? null;

    // 같은 상태 재클릭: no-op. 단, 기록이 이미 있을 때만 —
    // 미기록(prevCheck 없음)에서 건너뛰기(score=null)는 새 기록으로 저장돼야 함
    if (prevCheck != null && prevScore === score) return;

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

    const { bumpCombo, triggerCelebration, tryRewardHabit } = useAppStore.getState();

    // 서버 정산과 동일한 델타: 현재 점수 포인트 − 이전 점수 포인트
    const basePts = score === null ? 0 : pointsForCheck(habit.weight, habit.scoreMode, score);
    const prevBasePts = prevScore === null ? 0 : pointsForCheck(habit.weight, habit.scoreMode, prevScore);
    const delta = basePts - prevBasePts;

    if (score === null) {
      // 건너뛰기 — 콤보는 유지(중립). 단, 이미 적립된 점수가 있으면 그만큼 삭감.
      feedback('check');
      if (delta < 0) {
        toast(`✦ ${delta}P`, { description: `${habit.title} · 건너뛰기 (기록 취소)` });
      } else {
        toast('건너뜀', { description: habit.title });
      }
      return;
    }

    // 포인트 감소 — 점수 하향 또는 완료 해제(이진 모드 미완료)
    if (delta < 0) {
      const downReason = basePts === 0 ? '완료 해제' : '점수 하향';
      feedback('check');
      toast(`✦ ${delta}P`, { description: `${habit.title} · ${downReason}` });
      return;
    }

    if (delta === 0) return; // 변화 없음

    // delta > 0 — 점수 상향 또는 첫 체크.
    // 콤보·셀러브레이션은 한 습관당 하루 한 번만(rewardedHabitIds 게이트), 포인트 토스트는 매 상승마다.
    const firstRewardToday = tryRewardHabit(habit.id);
    const perfect = habit.scoreMode === 'scaled' && score === 5;

    if (achieved) {
      let combo = 0;
      let comboBonus = 0;
      if (firstRewardToday) {
        combo = bumpCombo();
        comboBonus = combo >= 3 ? combo : 0;
      }
      const displayPts = delta + comboBonus;

      feedback(perfect ? 'perfect' : 'achieve');
      if (firstRewardToday && combo >= 3) feedback('combo');

      toast(`✦ +${displayPts}P`, {
        description:
          comboBonus > 0
            ? `${habit.title} 달성 · 🔥${combo} 콤보 +${comboBonus}`
            : `${habit.title} 달성`,
      });

      if (perfect && firstRewardToday) {
        triggerCelebration('perfect', {
          title: habit.title,
          points: displayPts,
          detail: comboBonus > 0 ? `🔥 ${combo} 콤보` : undefined,
        });
      }
    } else {
      // 부분 점수 — 작은 토스트, 콤보는 끊지 않음
      feedback('check');
      toast(`✦ +${delta}P`, { description: `${habit.title} · 시도 인정` });
    }
  };
}
