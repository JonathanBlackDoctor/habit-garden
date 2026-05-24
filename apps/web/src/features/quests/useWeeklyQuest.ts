import { useEffect, useMemo } from 'react';
import { doc, setDoc, serverTimestamp, collection, addDoc, collectionGroup, onSnapshot, query, where, runTransaction } from 'firebase/firestore';
import { useState } from 'react';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import { useProgress } from '@/features/garden/useGarden';
import { useHabits } from '@/features/habits/useHabits';
import { pickWeeklyQuest, weekStartOf, datesOfWeek, WEEKLY_QUESTS } from './quests';
import type { HabitCheckDoc, ProgressDoc } from 'shared/types/firestore';
import { feedback } from '@/lib/feedback';
import { toast } from 'sonner';

/**
 * Phase 4-1 — 주간 퀘스트.
 *  - 진입 시 weekStart 가 다르면 새 퀘스트 픽
 *  - 진행률을 클라이언트에서 계산 (사용자 본인 디바이스만)
 *  - 목표 달성 + 보상 미수령 시 자동으로 포인트/토큰 지급
 */
export function useWeeklyQuest() {
  const uid = useAppStore((s) => s.uid);
  const today = useAppStore((s) => s.currentDate);
  const habits = useHabits();
  const progress = useProgress();
  const ws = weekStartOf(today);
  const dates = useMemo(() => datesOfWeek(ws), [ws]);

  const [checks, setChecks] = useState<Array<HabitCheckDoc & { date: string }>>([]);

  useEffect(() => {
    if (!uid) return;
    const q = query(
      collectionGroup(db, 'habitChecks'),
      where('checkedAt', '>=', new Date(ws)),
    );
    return onSnapshot(
      q,
      (snap) => {
        const items: Array<HabitCheckDoc & { date: string }> = [];
        snap.docs.forEach((d) => {
          const parts = d.ref.path.split('/');
          if (parts[1] !== uid) return;
          const idx = parts.indexOf('days');
          const date = parts[idx + 1];
          if (!dates.includes(date)) return;
          items.push({ ...(d.data() as HabitCheckDoc), date });
        });
        setChecks(items);
      },
      () => setChecks([]),
    );
  }, [uid, ws, dates]);

  // 주가 바뀌면 퀘스트 자동 픽
  useEffect(() => {
    if (!uid || !progress) return;
    const cur = progress.weeklyQuest;
    if (cur && cur.weekStart === ws) return;
    const pick = pickWeeklyQuest(ws);
    setDoc(
      doc(db, 'users', uid, 'progress', 'main'),
      {
        weeklyQuest: {
          id: pick.id,
          weekStart: ws,
          goal: pick.goal,
          current: 0,
          reward: pick.reward,
        },
        updatedAt: serverTimestamp() as any,
      },
      { merge: true },
    ).catch(() => {});
  }, [uid, ws, progress?.weeklyQuest?.weekStart]);

  const def = useMemo(() => {
    const id = progress?.weeklyQuest?.id;
    return WEEKLY_QUESTS.find((q) => q.id === id) ?? null;
  }, [progress?.weeklyQuest?.id]);

  const current = def ? def.progress({ dates, habits, checks }) : 0;
  const goal = progress?.weeklyQuest?.goal ?? 0;
  const completed = !!progress?.weeklyQuest?.completedAt;

  // 자동 보상 — 트랜잭션으로 주당 1회만.
  // completedAt을 서버 커밋값 기준으로 원자적으로 검사·설정하므로,
  // habitChecks 구독 재계산이나 빠른 재렌더로 effect가 여러 번 떠도 중복 적립되지 않는다.
  useEffect(() => {
    if (!uid || !progress?.weeklyQuest || completed) return;
    if (current < goal || goal === 0) return;

    const progressRef = doc(db, 'users', uid, 'progress', 'main');
    (async () => {
      const reward = await runTransaction(db, async (tx) => {
        const p = (await tx.get(progressRef)).data() as ProgressDoc | undefined;
        const q = p?.weeklyQuest;
        // 이미 완료됐거나 다른 주 퀘스트면 중단 (멱등 게이트)
        if (!q || q.completedAt || q.weekStart !== ws || current < q.goal) return null;

        const patch: any = {
          weeklyQuest: { ...q, completedAt: serverTimestamp(), current },
          spendablePoints: (p?.spendablePoints ?? 0) + q.reward.points,
          totalPoints: (p?.totalPoints ?? 0) + q.reward.points,
          updatedAt: serverTimestamp(),
        };
        if (q.reward.freezeTokens) {
          patch.freezeTokens = (p?.freezeTokens ?? 0) + q.reward.freezeTokens;
        }
        tx.set(progressRef, patch, { merge: true });
        return { points: q.reward.points, freezeTokens: q.reward.freezeTokens, id: q.id };
      }).catch(() => null);

      if (!reward) return;

      await addDoc(collection(db, 'users', uid, 'pointLedger'), {
        delta: reward.points,
        reason: `weekly_quest_${reward.id}`,
        createdAt: serverTimestamp() as any,
      }).catch(() => {});
      feedback('levelup');
      toast(`🏆 주간 퀘스트 완료! +${reward.points}P${reward.freezeTokens ? ` · 🧊${reward.freezeTokens}` : ''}`, {
        duration: 6000,
      });
      useAppStore.getState().triggerCelebration('levelup', {
        title: '주간 퀘스트 완료',
        points: reward.points,
        detail: def?.title,
      });
    })();
  }, [uid, current, goal, completed]);

  return {
    def,
    current,
    goal,
    completed,
    quest: progress?.weeklyQuest ?? null,
  };
}
