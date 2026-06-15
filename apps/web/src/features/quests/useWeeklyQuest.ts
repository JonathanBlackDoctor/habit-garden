import { useEffect, useMemo } from 'react';
import { doc, setDoc, serverTimestamp, collection, addDoc, onSnapshot, runTransaction, Timestamp } from 'firebase/firestore';
import { useState } from 'react';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import { useProgress } from '@/features/garden/useGarden';
import { useHabits } from '@/features/habits/useHabits';
import { pickWeeklyQuests, weekStartOf, datesOfWeek, WEEKLY_QUESTS, type QuestDef } from './quests';
import type { HabitCheckDoc, ProgressDoc, WeeklyQuestData } from 'shared/types/firestore';
import { FREEZE_TOKEN_CAP } from 'shared/types/firestore';
import { feedback } from '@/lib/feedback';
import { toast } from 'sonner';

export interface QuestState {
  def: QuestDef;
  current: number;
  goal: number;
  completed: boolean;
}

/**
 * Phase 4-1 — 주간 퀘스트 (주당 3개).
 *  - 진입 시 weekStart 가 다르면 새 3종을 결정적으로 픽
 *  - 진행률을 클라이언트에서 계산 (사용자 본인 디바이스만)
 *  - 각 퀘스트 목표 달성 + 보상 미수령 시 자동으로 포인트/토큰 지급
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

  // 이번 주에 픽된 퀘스트 목록 (레거시 단일 weeklyQuest 는 무시 → 자동으로 3종 재픽)
  const weekQuests = useMemo<WeeklyQuestData[]>(() => {
    const list = progress?.weeklyQuests ?? [];
    return list.filter((q) => q.weekStart === ws);
  }, [progress?.weeklyQuests, ws]);

  // 주가 바뀌거나(또는 아직 없으면) 3종을 결정적으로 픽
  useEffect(() => {
    if (!uid || !progress) return;
    if (weekQuests.length > 0) return;
    const picks = pickWeeklyQuests(ws, 3);
    setDoc(
      doc(db, 'users', uid, 'progress', 'main'),
      {
        weeklyQuests: picks.map((p) => ({
          id: p.id,
          weekStart: ws,
          goal: p.goal,
          current: 0,
          reward: p.reward,
        })),
        updatedAt: serverTimestamp() as any,
      },
      { merge: true },
    ).catch(() => {});
    // progress 를 의존성에 포함: progress 가 uid 보다 늦게 로드될 때(일반적인 순서),
    // weekQuests.length 가 0 으로 머물러 deps 가 바뀌지 않으면 첫 주차 픽이 누락된다.
    // progress 로드(null→객체) 시 한 번 더 평가되도록 한다. 픽 이후엔 weekQuests.length>0 가드로 멈춘다.
  }, [uid, ws, progress, weekQuests.length]);

  const quests = useMemo<QuestState[]>(() => {
    return weekQuests
      .map((q) => {
        const def = WEEKLY_QUESTS.find((d) => d.id === q.id);
        if (!def) return null;
        return {
          def,
          current: def.progress({ dates, habits, checks }),
          goal: q.goal,
          completed: !!q.completedAt,
        } as QuestState;
      })
      .filter((s): s is QuestState => s !== null);
  }, [weekQuests, dates, habits, checks]);

  // 자동 보상 — 퀘스트별로 트랜잭션 처리. 배열 내 해당 퀘스트의 completedAt 을
  // 원자적으로 검사·설정해, 재렌더로 effect 가 여러 번 떠도 중복 적립되지 않는다.
  // freezeTokens 는 FREEZE_TOKEN_CAP 으로 상한.
  useEffect(() => {
    if (!uid) return;
    const ready = quests.filter((s) => !s.completed && s.goal > 0 && s.current >= s.goal);
    if (ready.length === 0) return;

    const progressRef = doc(db, 'users', uid, 'progress', 'main');
    (async () => {
      for (const s of ready) {
        const reward = await runTransaction(db, async (tx) => {
          const p = (await tx.get(progressRef)).data() as ProgressDoc | undefined;
          const list = p?.weeklyQuests ?? [];
          const idx = list.findIndex((q) => q.id === s.def.id && q.weekStart === ws);
          if (idx < 0) return null;
          const q = list[idx];
          if (q.completedAt || s.current < q.goal) return null;

          // 지급액은 현재 정의(WEEKLY_QUESTS) 기준 — 카드 표시와 일치.
          const payout = WEEKLY_QUESTS.find((d) => d.id === q.id)?.reward ?? q.reward;

          // 배열 요소 안에서는 serverTimestamp() sentinel 을 쓸 수 없어 클라 시각 사용.
          const next = list.slice();
          next[idx] = { ...q, completedAt: Timestamp.now(), current: s.current };

          const patch: any = {
            weeklyQuests: next,
            spendablePoints: (p?.spendablePoints ?? 0) + payout.points,
            totalPoints: (p?.totalPoints ?? 0) + payout.points,
            updatedAt: serverTimestamp(),
          };
          if (payout.freezeTokens) {
            patch.freezeTokens = Math.min((p?.freezeTokens ?? 0) + payout.freezeTokens, FREEZE_TOKEN_CAP);
          }
          tx.set(progressRef, patch, { merge: true });
          return { points: payout.points, freezeTokens: payout.freezeTokens, id: q.id, title: s.def.title };
        }).catch(() => null);

        if (!reward) continue;

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
          detail: reward.title,
        });
      }
    })();
  }, [uid, ws, quests]);

  return { quests };
}
