import { collection, doc, setDoc, addDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import { useProgress } from '@/features/garden/useGarden';
import type { PlantInstance } from 'shared/types/firestore';
import { PLANT_SPECIES } from 'shared/types/firestore';
import { toast } from 'sonner';

const MIN_FREEZE_PRICE = 10;

// 현재 보유 식물들의 스트릭 의존도를 기반으로 토큰 사용 비용 계산.
// streak-sensitive 특성을 가진 식물일수록, 그리고 성장 단계가 높을수록 보호 가치가 높아져 비용 증가.
function calcFreezePrice(plants: PlantInstance[], prayerStreak: number): number {
  let bonus = 0;

  for (const plant of plants) {
    const species = PLANT_SPECIES.find(s => s.id === plant.speciesId);
    if (!species?.trait) continue;

    const maxStage = (species.stages ?? 4) - 1;
    const stageRatio = maxStage > 0 ? plant.stage / maxStage : 0;
    const { trait } = species;

    if (trait.kind === 'brittle') {
      // 하루 실패로 즉사 — 현재 단계 수확량 전액 위험
      bonus += Math.round(species.harvestYield * stageRatio);
    } else if (trait.kind === 'fragile') {
      // 실패→시듦→죽음 — 절반 위험
      bonus += Math.round(species.harvestYield * stageRatio * 0.5);
    } else if (trait.kind === 'regress') {
      // 실패마다 단계 퇴보 — 40% 위험
      bonus += Math.round(species.harvestYield * stageRatio * 0.4);
    } else if (trait.kind === 'waning') {
      // graceDays 연속 실패 시 죽음 — 30% 위험
      bonus += Math.round(species.harvestYield * stageRatio * 0.3);
    } else if (trait.kind === 'radiant') {
      // 만개 후 실패 즉사 — 만개 상태일 때만 위험
      if (plant.stage >= maxStage) {
        bonus += Math.round(species.harvestYield * 0.8);
      }
    } else if (trait.kind === 'streakSync' && prayerStreak > 0) {
      // 기도 스트릭 활성 중인 streakSync 식물 — 수확 보너스 50% 손실 위험
      bonus += Math.round(species.harvestYield * 0.5 * stageRatio);
    }
  }

  return (MIN_FREEZE_PRICE + bonus) * 2;
}

export function useFreezeTokens() {
  const uid = useAppStore((s) => s.uid);
  const progress = useProgress();

  const plants = progress?.gardenState?.plants ?? [];
  const prayerStreak = (progress as any)?.prayerStreak ?? 0;
  const price = calcFreezePrice(plants, prayerStreak);
  const count = (progress as any)?.freezeTokens ?? 0;

  const useOne = async () => {
    if (!uid || !progress) return false;
    const ref = doc(db, 'users', uid, 'progress', 'main');
    const snap = await getDoc(ref);
    const existing = snap.exists() ? (snap.data() as any).freezeTokens ?? 0 : 0;
    if (existing <= 0) {
      toast.error('Freeze 토큰이 없어요');
      return false;
    }
    if (progress.spendablePoints < price) {
      toast.error(`포인트 부족 (필요 ${price}P)`);
      return false;
    }
    await setDoc(
      ref,
      {
        freezeTokens: existing - 1,
        spendablePoints: progress.spendablePoints - price,
        updatedAt: serverTimestamp() as any,
      },
      { merge: true },
    );
    await addDoc(collection(db, 'users', uid, 'pointLedger'), {
      delta: -price,
      reason: 'use_freeze_token',
      createdAt: serverTimestamp() as any,
    });
    toast('🧊 토큰을 사용했어요. 스트릭이 유지됩니다.');
    return true;
  };

  return { count, useOne, price };
}
