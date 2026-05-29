import { collection, doc, serverTimestamp, runTransaction, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import { useProgress } from '@/features/garden/useGarden';
import type { PlantInstance, ProgressDoc } from 'shared/types/firestore';
import { PLANT_SPECIES } from 'shared/types/firestore';
import { toast } from 'sonner';

const MIN_FREEZE_PRICE = 10;

// 동일 시점 중복 실행 가드 (모듈 레벨 — 훅 인스턴스 간 공유)
let freezeInFlight = false;

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
    // harvestYield 는 옵셔널 — 누락 시 0 으로 처리해 NaN(→ 잔액 손상)을 방지한다.
    const hy = species.harvestYield ?? 0;

    if (trait.kind === 'brittle') {
      // 하루 실패로 즉사 — 현재 단계 수확량 전액 위험
      bonus += Math.round(hy * stageRatio);
    } else if (trait.kind === 'fragile') {
      // 실패→시듦→죽음 — 절반 위험
      bonus += Math.round(hy * stageRatio * 0.5);
    } else if (trait.kind === 'regress') {
      // 실패마다 단계 퇴보 — 40% 위험
      bonus += Math.round(hy * stageRatio * 0.4);
    } else if (trait.kind === 'waning') {
      // graceDays 연속 실패 시 죽음 — 30% 위험
      bonus += Math.round(hy * stageRatio * 0.3);
    } else if (trait.kind === 'radiant') {
      // 만개 후 실패 즉사 — 만개 상태일 때만 위험
      if (plant.stage >= maxStage) {
        bonus += Math.round(hy * 0.8);
      }
    } else if (trait.kind === 'streakSync' && prayerStreak > 0) {
      // 기도 스트릭 활성 중인 streakSync 식물 — 수확 보너스 50% 손실 위험
      bonus += Math.round(hy * 0.5 * stageRatio);
    } else if (trait.kind === 'transcendent') {
      // 초월: 하루 실패 즉사급. harvestYield가 0이므로 심기 원가(seedCost) 기준으로 위험가치 산정.
      bonus += Math.round((species.seedCost ?? 0) * (0.5 + 0.5 * stageRatio));
    }
  }

  const price = (MIN_FREEZE_PRICE + bonus) * 2;
  return Number.isFinite(price) ? price : MIN_FREEZE_PRICE * 2;
}

export function useFreezeTokens() {
  const uid = useAppStore((s) => s.uid);
  const today = useAppStore((s) => s.currentDate);
  const progress = useProgress();

  const plants = progress?.gardenState?.plants ?? [];
  const prayerStreak = progress?.prayerStreak ?? 0;
  const price = calcFreezePrice(plants, prayerStreak);
  const count = progress?.freezeTokens ?? 0;

  // 트랜잭션 안에서 progress 를 다시 읽어 '신선한' 잔액·식물로 비용을 재계산하고
  // increment 로 차감한다 → 서버 트리거의 동시 적립을 stale 값으로 덮어쓰지 않는다.
  const useOne = async () => {
    if (!uid) return false;
    if (freezeInFlight) return false;
    const ref = doc(db, 'users', uid, 'progress', 'main');

    let outcome: 'ok' | 'poor' | 'noprog' = 'noprog';
    let charged = price;
    freezeInFlight = true;
    try {
      await runTransaction(db, async (tx) => {
        outcome = 'noprog';
        const snap = await tx.get(ref);
        if (!snap.exists()) return;
        const p = snap.data() as ProgressDoc;
        const freshPrice = calcFreezePrice(p.gardenState?.plants ?? [], p.prayerStreak ?? 0);
        charged = freshPrice;
        if ((p.spendablePoints ?? 0) < freshPrice) { outcome = 'poor'; return; }
        tx.set(ref, {
          spendablePoints: increment(-freshPrice),
          // 오늘을 보호일로 마킹 → 서버 일일 처리에서 스트릭·정원(초월·연약 전설)을 보호.
          freezeProtectedDate: today,
          updatedAt: serverTimestamp(),
        }, { merge: true });
        tx.set(doc(collection(db, 'users', uid, 'pointLedger')), {
          delta: -freshPrice, reason: 'use_freeze_token', createdAt: serverTimestamp(),
        });
        outcome = 'ok';
      });
    } catch (e) {
      toast.error('저장 실패: ' + (e as Error).message);
      return false;
    } finally {
      freezeInFlight = false;
    }

    if (outcome === 'poor') { toast.error(`포인트 부족 (필요 ${charged}P)`); return false; }
    if (outcome !== 'ok') return false;
    toast('🧊 토큰을 사용했어요. 스트릭이 유지됩니다.');
    return true;
  };

  return { count, useOne, price };
}
