import { useEffect, useMemo } from 'react';
import { doc, setDoc, serverTimestamp, collection, addDoc, collectionGroup, onSnapshot, query, where } from 'firebase/firestore';
import { useState } from 'react';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import { useProgress } from '@/features/garden/useGarden';
import { useHabits } from '@/features/habits/useHabits';
import { pickWeeklyQuest, weekStartOf, datesOfWeek, WEEKLY_QUESTS } from './quests';
import type { HabitCheckDoc } from 'shared/types/firestore';
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

  // 자동 보상 (한 번만)
  useEffect(() => {
    if (!uid || !progress?.weeklyQuest || completed) return;
    if (current < goal || goal === 0) return;

    const quest = progress.weeklyQuest;
    const reward = quest.reward;
    (async () => {
      // progress 갱신
      const patch: any = {
        weeklyQuest: { ...quest, completedAt: serverTimestamp() as any, current },
        spendablePoints: (progress.spendablePoints ?? 0) + reward.points,
        totalPoints: (progress.totalPoints ?? 0) + reward.points,
        updatedAt: serverTimestamp() as any,
      };
      if (reward.freezeTokens) {
        patch.freezeTokens = ((progress as any).freezeTokens ?? 0) + reward.freezeTokens;
      }
      await setDoc(doc(db, 'users', uid, 'progress', 'main'), patch, { merge: true });
      await addDoc(collection(db, 'users', uid, 'pointLedger'), {
        delta: reward.points,
        reason: `weekly_quest_${quest.id}`,
        createdAt: serverTimestamp() as any,
      });
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
