import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp, collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import type { ProgressDoc, PlantInstance } from 'shared/types/firestore';
import { PLANT_SPECIES, POINT_PRICES, CODEX_SPECIES_COUNT } from 'shared/types/firestore';
import { toast } from 'sonner';

// 첫 방문 시 테스트해볼 수 있도록 소량의 포인트와 새싹 1개를 지급
// plantedAt 은 setDoc 시점에 serverTimestamp() 로 주입 (PlantInstance.plantedAt 은 Timestamp 타입)
const DEFAULT_PROGRESS: Omit<ProgressDoc, 'updatedAt'> = {
  totalPoints:      200,
  spendablePoints:  200,
  level:            1,
  xpInLevel:        0,
  globalStreak:     0,
  globalBestStreak: 0,
  starterBonusApplied: true,
  gardenState: {
    plants: [
      { id: 'starter', speciesId: 'sprout', stage: 1, plantedAt: Timestamp.now() as any },
    ],
    unlockedSpecies:  ['sprout'],
    decorations:      [],
    health:           100,
  },
};

export function useProgress() {
  const uid = useAppStore((s) => s.uid);
  const [progress, setProgress] = useState<ProgressDoc | null>(null);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(doc(db, 'users', uid, 'progress', 'main'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as ProgressDoc;
        setProgress(data);

        // 기존 사용자 1회성 시작 보너스: 한 번도 받지 않은 사용자에 한해 적용.
        // 플래그(starterBonusApplied)가 없는 사용자만 대상 → 사용 후 다시 200P 미만이 되어도 재지급 X.
        if (!data.starterBonusApplied) {
          const needsPoints = (data.spendablePoints ?? 0) < 200;
          const needsPlant  = (data.gardenState?.plants?.length ?? 0) === 0;
          const patch: any = {
            starterBonusApplied: true,
            updatedAt: serverTimestamp(),
          };
          if (needsPoints) {
            const bump = 200 - (data.spendablePoints ?? 0);
            patch.spendablePoints = 200;
            patch.totalPoints = (data.totalPoints ?? 0) + bump;
          }
          if (needsPlant) {
            patch.gardenState = {
              ...(data.gardenState ?? { unlockedSpecies: ['sprout'], decorations: [], health: 100 }),
              plants: [{ id: 'starter', speciesId: 'sprout', stage: 1, plantedAt: Timestamp.now() as any }],
            };
          }
          setDoc(doc(db, 'users', uid, 'progress', 'main'), patch, { merge: true });
        }
      } else {
        // 첫 방문: progress 문서 초기화
        setDoc(doc(db, 'users', uid, 'progress', 'main'), {
          ...DEFAULT_PROGRESS,
          updatedAt: serverTimestamp(),
        });
      }
    });
  }, [uid]);

  return progress;
}

export function useGardenActions() {
  const uid      = useAppStore((s) => s.uid);
  const progress = useProgress();

  const plantSeed = async (speciesId: string) => {
    if (!uid || !progress) return;
    const baseSpecies = PLANT_SPECIES.find((s) => s.id === speciesId);
    if (!baseSpecies) return;
    if (!progress.gardenState.unlockedSpecies.includes(speciesId)) {
      toast.error('해금되지 않은 식물입니다.');
      return;
    }
    const cost = baseSpecies.seedCost ?? POINT_PRICES.SEED;
    if (progress.spendablePoints < cost) {
      toast.error(`포인트가 부족합니다. (필요: ${cost}P)`);
      return;
    }

    // 희귀 씨앗 드롭: 같은 해금 종 중 한 등급 위로 교체.
    // 무지개붓꽃 등 lucky 트레잇 종은 드롭 확률 1.5×.
    const unlocked = progress.gardenState.unlockedSpecies;
    const rarityRank: Record<string, number> = { basic: 0, common: 1, rare: 2, epic: 3, legendary: 4 };
    const dropChance = baseSpecies.trait?.kind === 'lucky' ? 0.15 : 0.10;
    let finalSpecies = baseSpecies;
    let upgraded = false;
    if (Math.random() < dropChance) {
      const targetRank = rarityRank[baseSpecies.rarity] + 1;
      const candidates = PLANT_SPECIES.filter(
        (s) => unlocked.includes(s.id) && rarityRank[s.rarity] === targetRank,
      );
      if (candidates.length > 0) {
        finalSpecies = candidates[Math.floor(Math.random() * candidates.length)];
        upgraded = true;
      }
    }

    // lucky 트레잇: 20% 확률로 stage 1 부터 시작
    const luckyStart = finalSpecies.trait?.kind === 'lucky' && Math.random() < 0.20;

    const newPlant: PlantInstance = {
      id:        Date.now().toString(),
      speciesId: finalSpecies.id,
      stage:     luckyStart ? 1 : 0,
      plantedAt: Timestamp.now() as any,
    };

    // 도감 갱신 — finalSpecies 도 codex 에 자동 등록 (초월은 별도 티어이므로 제외)
    const prevStats = progress.gardenStats ?? {};
    const prevCodex = prevStats.codexEntries ?? [];
    const nextCodex = (finalSpecies.rarity === 'transcendent' || prevCodex.includes(finalSpecies.id))
      ? prevCodex : [...prevCodex, finalSpecies.id];
    const nextRareDrops = (prevStats.rareDropsTriggered ?? 0) + (upgraded ? 1 : 0);

    const newPlants = [...progress.gardenState.plants, newPlant];
    try {
      await setDoc(doc(db, 'users', uid, 'progress', 'main'), {
        spendablePoints: progress.spendablePoints - cost,
        gardenState: { ...progress.gardenState, plants: newPlants },
        gardenStats: {
          ...prevStats,
          codexEntries: nextCodex,
          rareDropsTriggered: nextRareDrops,
        },
        updatedAt: serverTimestamp(),
      }, { merge: true });

      await addDoc(collection(db, 'users', uid, 'pointLedger'), {
        delta: -cost, reason: upgraded ? 'spend_plant_rare_drop' : 'spend_plant', refId: finalSpecies.id,
        createdAt: serverTimestamp(),
      });

      if (upgraded) {
        toast(`🌟 희귀 씨앗 발견! ${finalSpecies.name} 가 자랐어요! (-${cost}P)`);
      } else if (luckyStart) {
        toast(`🍀 ${finalSpecies.name} — 행운! 새싹부터 시작! (-${cost}P)`);
      } else {
        toast(`🌱 ${finalSpecies.name} 씨앗을 심었습니다! (-${cost}P)`);
      }
    } catch (e) {
      toast.error('저장 실패: ' + (e as Error).message);
    }
  };

  const waterPlant = async (plantId: string): Promise<boolean> => {
    if (!uid || !progress) return false;
    const cost = POINT_PRICES.WATER;
    if (progress.spendablePoints < cost) {
      toast.error(`포인트가 부족합니다. (필요: ${cost}P)`);
      return false;
    }
    const plants = progress.gardenState.plants.map((p) => {
      if (p.id !== plantId) return p;
      const species = PLANT_SPECIES.find((s) => s.id === p.speciesId);
      const maxStage = (species?.stages ?? 4) - 1;
      return { ...p, stage: Math.min(p.stage + 1, maxStage), witheredSince: undefined };
    });

    try {
      await setDoc(doc(db, 'users', uid, 'progress', 'main'), {
        spendablePoints: progress.spendablePoints - cost,
        gardenState: { ...progress.gardenState, plants },
        updatedAt: serverTimestamp(),
      }, { merge: true });

      await addDoc(collection(db, 'users', uid, 'pointLedger'), {
        delta: -cost, reason: 'spend_water', refId: plantId,
        createdAt: serverTimestamp(),
      });

      return true;
    } catch (e) {
      toast.error('저장 실패: ' + (e as Error).message);
      return false;
    }
  };

  const unlockSpecies = async (speciesId: string) => {
    if (!uid || !progress) return;
    const species = PLANT_SPECIES.find((s) => s.id === speciesId);
    if (!species || species.unlockCost === 0) return;
    if (progress.gardenState.unlockedSpecies.includes(speciesId)) {
      toast('이미 해금된 식물입니다.');
      return;
    }
    const cost = species.unlockCost;
    if (progress.spendablePoints < cost) {
      toast.error(`포인트가 부족합니다. (필요: ${cost}P)`);
      return;
    }
    const unlockedSpecies = [...progress.gardenState.unlockedSpecies, speciesId];

    // 도감 갱신 — 해금 시점에 자동 등록 (초월은 별도 티어이므로 제외)
    const prevStats = progress.gardenStats ?? {};
    const prevCodex = prevStats.codexEntries ?? [];
    const nextCodex = (species.rarity === 'transcendent' || prevCodex.includes(speciesId))
      ? prevCodex : [...prevCodex, speciesId];

    try {
      await setDoc(doc(db, 'users', uid, 'progress', 'main'), {
        spendablePoints: progress.spendablePoints - cost,
        gardenState: { ...progress.gardenState, unlockedSpecies },
        gardenStats: { ...prevStats, codexEntries: nextCodex },
        updatedAt: serverTimestamp(),
      }, { merge: true });

      await addDoc(collection(db, 'users', uid, 'pointLedger'), {
        delta: -cost, reason: 'unlock_species', refId: speciesId,
        createdAt: serverTimestamp(),
      });

      if (species.rarity === 'transcendent') {
        toast(`✨ ${species.name} 해금! 초월의 식물을 맞이했습니다.`);
      } else {
        toast(`🌿 ${species.name} 해금! 도감 ${nextCodex.length}/${CODEX_SPECIES_COUNT}`);
      }
    } catch (e) {
      toast.error('저장 실패: ' + (e as Error).message);
    }
  };

  const harvestPlant = async (plantId: string) => {
    if (!uid || !progress) return;
    const plant = progress.gardenState.plants.find((p) => p.id === plantId);
    if (!plant) return;
    const species = PLANT_SPECIES.find((s) => s.id === plant.speciesId);
    if (!species) return;
    const maxStage = (species.stages ?? 4) - 1;
    if (plant.stage < maxStage) {
      toast.error('아직 만개하지 않았습니다.');
      return;
    }

    // 수확량 계산
    const prevStats = progress.gardenStats ?? {};
    const prevHarvestsBySpecies = prevStats.harvestsBySpecies ?? {};
    const speciesCount = prevHarvestsBySpecies[species.id] ?? 0;       // 수확 횟수 (★ 적용에 사용)
    const star3Bonus = speciesCount >= 30 ? 0.10 : 0;                 // ★3 (30회 이상) → +10%

    const base = species.harvestYield ?? 10;
    const baseAdjusted = Math.round(base * (1 + star3Bonus));

    // 등급 누적 보너스
    let rarityBonus = 0;
    if (species.rarity === 'rare')        rarityBonus = POINT_PRICES.HARVEST_BONUS_RARE;
    else if (species.rarity === 'epic')   rarityBonus = POINT_PRICES.HARVEST_BONUS_RARE + POINT_PRICES.HARVEST_BONUS_EPIC;
    else if (species.rarity === 'legendary')
      rarityBonus = POINT_PRICES.HARVEST_BONUS_RARE + POINT_PRICES.HARVEST_BONUS_EPIC + POINT_PRICES.HARVEST_BONUS_LEGENDARY;

    const streakBonus = (species.trait?.kind === 'streakSync' && (progress.prayerStreak ?? 0) > 0)
      ? Math.round(baseAdjusted * 0.5) : 0;
    const totalYield = baseAdjusted + rarityBonus + streakBonus;

    // 연꽃·고사리·달꽃(healer) 트레잇: 정원 생기 회복
    let nextHealth = progress.gardenState.health ?? 100;
    if (species.trait?.kind === 'healer') {
      nextHealth = Math.min(100, nextHealth + species.trait.heal);
    }

    // 통계 갱신
    const nextHarvestsBySpecies = { ...prevHarvestsBySpecies, [species.id]: speciesCount + 1 };
    const prevHarvestsByRarity = prevStats.harvestsByRarity ?? {};
    const nextHarvestsByRarity = {
      ...prevHarvestsByRarity,
      [species.rarity]: (prevHarvestsByRarity[species.rarity] ?? 0) + 1,
    };

    // ★ 마일스톤 토스트 후보
    const newCount = speciesCount + 1;
    const milestone = newCount === 5 ? '★1' : newCount === 15 ? '★2' : newCount === 30 ? '★3 (영구 +10%)' : null;

    const newPlants = progress.gardenState.plants.filter((p) => p.id !== plantId);
    try {
      await setDoc(doc(db, 'users', uid, 'progress', 'main'), {
        spendablePoints: (progress.spendablePoints ?? 0) + totalYield,
        totalPoints: (progress.totalPoints ?? 0) + totalYield,
        gardenState: { ...progress.gardenState, plants: newPlants, health: nextHealth },
        gardenStats: {
          ...prevStats,
          harvestsBySpecies: nextHarvestsBySpecies,
          harvestsByRarity: nextHarvestsByRarity,
        },
        updatedAt: serverTimestamp(),
      }, { merge: true });

      await addDoc(collection(db, 'users', uid, 'pointLedger'), {
        delta: totalYield, reason: 'harvest_plant', refId: plantId,
        createdAt: serverTimestamp(),
      });

      const bonusLabel = [
        streakBonus ? '기도 보너스 ✨' : '',
        star3Bonus ? '★3 +10%' : '',
      ].filter(Boolean).join(' · ');
      toast(`🌾 ${species.name} 수확! +${totalYield}P${bonusLabel ? ` (${bonusLabel})` : ''}`);
      if (milestone) {
        toast(`⭐ ${species.name} ${newCount}회 수확 — ${milestone} 달성!`);
      }
    } catch (e) {
      toast.error('저장 실패: ' + (e as Error).message);
    }
  };

  const digUpPlant = async (plantId: string) => {
    if (!uid || !progress) return;
    const plant = progress.gardenState.plants.find((p) => p.id === plantId);
    if (!plant) return;
    const species = PLANT_SPECIES.find((s) => s.id === plant.speciesId);

    const newPlants = progress.gardenState.plants.filter((p) => p.id !== plantId);
    const prevStats = progress.gardenStats ?? {};

    try {
      await setDoc(doc(db, 'users', uid, 'progress', 'main'), {
        gardenState: { ...progress.gardenState, plants: newPlants },
        gardenStats: {
          ...prevStats,
          plantsLost: (prevStats.plantsLost ?? 0) + 1,
        },
        updatedAt: serverTimestamp(),
      }, { merge: true });

      toast(`🪴 ${species?.name ?? '식물'}을(를) 파냈습니다.`);
    } catch (e) {
      toast.error('저장 실패: ' + (e as Error).message);
    }
  };

  return { plantSeed, waterPlant, unlockSpecies, harvestPlant, digUpPlant };
}
