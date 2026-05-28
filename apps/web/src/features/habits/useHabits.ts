import { useEffect, useState } from 'react';
import {
  collection, onSnapshot, query, orderBy, doc, setDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import type { HabitDoc, HabitCheckDoc } from 'shared/types/firestore';
import { pointsForCheck, SCALED_ACHIEVE_THRESHOLD } from 'shared/lib/habitPoints';
import { toast } from 'sonner';
import { feedback } from '@/lib/feedback';
import { useProgress } from '@/features/garden/useGarden';

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
 * 체크 문서를 삭제해 '미기록' 상태로 되돌린다.
 * 건너뜀(score=null) 취소 등에 사용. 콤보·셀러브레이션은 건드리지 않는다.
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
  const progress = useProgress();

  return async (
    habit: HabitDoc,
    score: number | null,
    prevCheck?: HabitCheckDoc | null,
    priorStreak = 0,   // 오늘 직전까지의 연속 달성일 (useHabitStreaks 값)
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

    const { triggerCelebration, tryRewardHabit } = useAppStore.getState();

    // Comeback Mode(progress.comebackUntil ≥ 오늘)면 서버가 포인트 ×2 적립 — 토스트도 동일 배수로 표시.
    const inComeback = !!(progress?.comebackUntil && progress.comebackUntil >= date);
    const mult = inComeback ? 2 : 1;

    // 서버 정산과 동일한 델타: 현재 점수 포인트 − 이전 점수 포인트
    const basePts = score === null ? 0 : pointsForCheck(habit.weight, habit.scoreMode, score);
    const prevBasePts = prevScore === null ? 0 : pointsForCheck(habit.weight, habit.scoreMode, prevScore);
    const delta = basePts - prevBasePts;

    if (score === null) {
      // 건너뛰기 — 콤보는 유지(중립). 단, 이미 적립된 점수가 있으면 그만큼 삭감.
      feedback('check');
      if (delta < 0) {
        toast(`✦ ${delta * mult}P`, { description: `${habit.title} · 건너뛰기 (기록 취소)` });
      } else {
        toast('건너뜀', { description: habit.title });
      }
      return;
    }

    // 포인트 감소 — 점수 하향 또는 완료 해제(이진 모드 미완료)
    if (delta < 0) {
      const downReason = basePts === 0 ? '완료 해제' : '점수 하향';
      feedback('check');
      toast(`✦ ${delta * mult}P`, { description: `${habit.title} · ${downReason}` });
      return;
    }

    if (delta === 0) {
      // 점수는 기록됐지만 보상 없음 (5점 척도 1점, 완료형 미완료 등) — 가벼운 확인만
      if (basePts === 0 && score !== null) {
        feedback('check');
        toast('기록됨', { description: `${habit.title} · 보상 없음` });
      }
      return; // 변화 없음
    }

    // delta > 0 — 점수 상향 또는 첫 체크.
    // 콤보·셀러브레이션은 한 습관당 하루 한 번만(rewardedHabitIds 게이트), 포인트 토스트는 매 상승마다.
    const firstRewardToday = tryRewardHabit(habit.id);
    const perfect = habit.scoreMode === 'scaled' && score === 5;

    if (achieved) {
      // 콤보 = 이 습관의 연속 달성일(오늘 포함). 2일 연속부터 발동, 보너스는 10P로 캡.
      let combo = 0;
      let comboBonus = 0;
      if (firstRewardToday) {
        combo = priorStreak + 1;
        comboBonus = combo >= 2 ? Math.min(combo, 10) : 0;
      }
      // 점수는 ×배수, 연속일(combo)은 일수라 그대로
      const displayPts = (delta + comboBonus) * mult;
      const displayBonus = comboBonus * mult;

      feedback(perfect ? 'perfect' : 'achieve');
      if (firstRewardToday && combo >= 2) feedback('combo');

      toast(`✦ +${displayPts}P`, {
        description:
          comboBonus > 0
            ? `${habit.title} 달성 · 🔥${combo}일 연속 +${displayBonus}`
            : `${habit.title} 달성`,
      });

      if (perfect && firstRewardToday) {
        triggerCelebration('perfect', {
          title: habit.title,
          points: displayPts,
          detail: comboBonus > 0 ? `🔥 ${combo}일 연속` : undefined,
        });
      }
    } else {
      // 부분 점수 — 작은 토스트
      feedback('check');
      toast(`✦ +${delta * mult}P`, { description: `${habit.title} · 시도 인정` });
    }
  };
}
