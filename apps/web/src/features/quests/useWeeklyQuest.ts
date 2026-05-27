import { useEffect, useMemo } from 'react';
import { doc, setDoc, serverTimestamp, collection, addDoc, onSnapshot, runTransaction } from 'firebase/firestore';
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

  // 주의 7일 각각의 habitChecks 하위컬렉션을 직접 구독한다.
  // collectionGroup + checkedAt 부등호 쿼리는 콜렉션그룹 인덱스를 요구하고(미배포 시 무음 실패),
  // checkedAt(UTC) 하한이 KST 04:00 플래너 경계와 어긋나 월요일 새벽 체크를 누락시킨다.
  // 본인 소유 경로 직접 읽기는 인덱스가 필요 없고 날짜 폴더가 곧 플래너 날짜라 정확하다.
  const [checksByDate, setChecksByDate] = useState<Record<string, Array<HabitCheckDoc & { date: string }>>>({});

  useEffect(() => {
    if (!uid) return;
    setChecksByDate({});
    const unsubs = dates.map((date) =>
      onSnapshot(
        collection(db, 'users', uid, 'days', date, 'habitChecks'),
        (snap) => {
          const items = snap.docs.map((d) => ({ ...(d.data() as HabitCheckDoc), date }));
          setChecksByDate((prev) => ({ ...prev, [date]: items }));
        },
        () => setChecksByDate((prev) => ({ ...prev, [date]: [] })),
      ),
    );
    return () => unsubs.forEach((u) => u());
  }, [uid, dates]);

  const checks = useMemo(() => Object.values(checksByDate).flat(), [checksByDate]);

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
