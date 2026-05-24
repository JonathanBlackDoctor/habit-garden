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

    if (score === null) {
      // 의도적 건너뛰기 — 중립 처리: 콤보 유지, 스트릭 영향 없음
      feedback('check');
      toast('건너뜀', { description: habit.title });
      return;
    }

    const basePts = pointsForCheck(habit.weight, habit.scoreMode, score);

    // 보상 없는 입력(예: 이진 모드 미완료 score=0)은 게이트를 소비하지 않음
    if (basePts <= 0) {
      feedback('check');
      return;
    }

    // 보상 연출(포인트 토스트·콤보·셀러브레이션)은 한 습관당 하루 한 번.
    // 점수 변경(1↔5)·체크↔해제 반복 시에는 추가 보상이 나오지 않는다.
    if (!tryRewardHabit(habit.id)) {
      feedback('check');
      return;
    }

    const perfect = habit.scoreMode === 'scaled' && score === 5;

    if (achieved) {
      const combo = bumpCombo();
      const comboBonus = combo >= 3 ? combo : 0;
      const displayPts = basePts + comboBonus;

      feedback(perfect ? 'perfect' : 'achieve');
      if (combo >= 3) feedback('combo');

      toast(`✦ +${displayPts}P`, {
        description:
          comboBonus > 0
            ? `${habit.title} 달성 · 🔥${combo} 콤보 +${comboBonus}`
            : `${habit.title} 달성`,
      });

      if (perfect) {
        triggerCelebration('perfect', {
          title: habit.title,
          points: displayPts,
          detail: comboBonus > 0 ? `🔥 ${combo} 콤보` : undefined,
        });
      }
    } else {
      // 부분 점수 — 작은 토스트, 콤보는 끊지 않음
      feedback('check');
      toast(`✦ +${basePts}P`, { description: `${habit.title} · 시도 인정` });
    }
  };
}
