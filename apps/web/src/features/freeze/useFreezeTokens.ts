import { collection, onSnapshot, doc, setDoc, addDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import { useProgress } from '@/features/garden/useGarden';
import type { HabitStreakData } from 'shared/types/firestore';
import { toast } from 'sonner';

const FREEZE_PRICE = 50;

/**
 * Phase 4-3 — Freeze 토큰 합계/구매/소모.
 * 각 습관의 users/{uid}/habits/{id}/streakMeta/state 문서에 freezeTokens 가 존재.
 * 글로벌 합산은 클라이언트에서 합산 — 가짜 단순 모델.
 */
export function useFreezeTokens() {
  const uid = useAppStore((s) => s.uid);
  const progress = useProgress();
  const [byHabit, setByHabit] = useState<Record<string, HabitStreakData>>({});

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(collection(db, 'users', uid, 'habits'), () => {
      // streakMeta 는 별도 서브컬렉션 — 합산을 단순화하기 위해 habits 변화로만 트리거하고
      // 실제 구독은 그대로 두지 않음. 첫 출시 단계에서는 progress 의 전역 카운터 1개만 운영.
    });
  }, [uid]);

  const total = Object.values(byHabit).reduce((acc, s) => acc + (s.freezeTokens ?? 0), 0);

  const buyOne = async () => {
    if (!uid || !progress) return;
    if (progress.spendablePoints < FREEZE_PRICE) {
      toast.error(`포인트 부족 (필요 ${FREEZE_PRICE}P)`);
      return;
    }
    // 글로벌 토큰: progress.gardenState.decorations 대신 별도 필드 — 단순화를 위해
    // ProgressDoc 에 freezeTokens 필드를 옵셔널로 누적.
    const ref = doc(db, 'users', uid, 'progress', 'main');
    const snap = await getDoc(ref);
    const existing = snap.exists() ? (snap.data() as any).freezeTokens ?? 0 : 0;
    await setDoc(
      ref,
      {
        spendablePoints: progress.spendablePoints - FREEZE_PRICE,
        freezeTokens: existing + 1,
        updatedAt: serverTimestamp() as any,
      },
      { merge: true },
    );
    await addDoc(collection(db, 'users', uid, 'pointLedger'), {
      delta: -FREEZE_PRICE,
      reason: 'spend_freeze_token',
      createdAt: serverTimestamp() as any,
    });
    toast('🧊 Freeze 토큰 1개 획득');
  };

  const useOne = async () => {
    if (!uid) return false;
    const ref = doc(db, 'users', uid, 'progress', 'main');
    const snap = await getDoc(ref);
    const existing = snap.exists() ? (snap.data() as any).freezeTokens ?? 0 : 0;
    if (existing <= 0) {
      toast.error('Freeze 토큰이 없어요');
      return false;
    }
    await setDoc(
      ref,
      { freezeTokens: existing - 1, updatedAt: serverTimestamp() as any },
      { merge: true },
    );
    toast('🧊 토큰을 사용했어요. 스트릭이 유지됩니다.');
    return true;
  };

  // progress.freezeTokens 우선, 없으면 byHabit 합계
  const globalCount = (progress as any)?.freezeTokens ?? total;

  return { count: globalCount, buyOne, useOne, price: FREEZE_PRICE };
}
