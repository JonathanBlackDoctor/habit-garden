import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp, collection, runTransaction, increment, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import type { ProgressDoc, PlantInstance } from 'shared/types/firestore';
import { PLANT_SPECIES, POINT_PRICES, CODEX_SPECIES_COUNT, MAX_BEDS, PLANTS_PER_BED, DAILY_PLANT_LIMIT } from 'shared/types/firestore';
import { toast } from 'sonner';

// 현재 게임일을 'YYYY-MM-DD'(KST 04:00 기준)로 반환한다.
export function getGameDayKST(): string {
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const RESET_HOUR_MS = 4 * 60 * 60 * 1000;
  const DAY_MS = 24 * 60 * 60 * 1000;

  const nowKST = Date.now() + KST_OFFSET_MS;
  const msSinceMidnightKST = nowKST % DAY_MS;
  // 04:00 이전이면 전날 게임일
  const adjustedKST = msSinceMidnightKST >= RESET_HOUR_MS ? nowKST : nowKST - DAY_MS;
  const d = new Date(adjustedKST);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// 게임 하루는 04:00 KST 기준으로 리셋된다.
export function isWateredToday(wateredAt: { toMillis(): number }): boolean {
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const RESET_HOUR_MS = 4 * 60 * 60 * 1000; // 04:00 KST in ms
  const DAY_MS = 24 * 60 * 60 * 1000;

  const nowKST = Date.now() + KST_OFFSET_MS;
  const msSinceMidnightKST = nowKST % DAY_MS;
  const gameDayStartKST = nowKST - msSinceMidnightKST +
    (msSinceMidnightKST >= RESET_HOUR_MS ? RESET_HOUR_MS : RESET_HOUR_MS - DAY_MS);

  return wateredAt.toMillis() + KST_OFFSET_MS >= gameDayStartKST;
}

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

// 동일 액션의 중복 호출(빠른 더블탭) 가드. 트랜잭션이 정확성(이중지불·중복수확 방지)을
// 보장하지만, 불필요한 두 번째 트랜잭션과 중복 토스트를 막는다. 훅 인스턴스 간 공유되도록 모듈 레벨.
const inFlight = new Set<string>();

export function useGardenActions() {
  const uid = useAppStore((s) => s.uid);

  // 모든 변이는 progress/main 트랜잭션 안에서 '신선한' 값을 다시 읽어 검증·기록한다.
  // 포인트는 increment 로 적립/차감해 서버 트리거(awardEngine 등)의 동시 적립을 덮어쓰지 않는다.
  // 원장(pointLedger)도 같은 트랜잭션에서 기록해 잔액과 원자적으로 일치시킨다.

  const plantSeed = async (speciesId: string) => {
    if (!uid) return;
    const key = `plant:${speciesId}`;
    if (inFlight.has(key)) return;
    const baseSpecies = PLANT_SPECIES.find((s) => s.id === speciesId);
    if (!baseSpecies) return;

    // 드롭·행운은 액션당 한 번만 결정한다 (트랜잭션 재시도 시 재추첨 방지)
    const rarityRank: Record<string, number> = { basic: 0, common: 1, rare: 2, epic: 3, legendary: 4 };
    const dropChance = baseSpecies.trait?.kind === 'lucky' ? 0.15 : 0.10;
    let finalSpecies = baseSpecies;
    let upgraded = false;
    if (Math.random() < dropChance) {
      const targetRank = rarityRank[baseSpecies.rarity] + 1;
      const candidates = PLANT_SPECIES.filter((s) => rarityRank[s.rarity] === targetRank);
      if (candidates.length > 0) {
        finalSpecies = candidates[Math.floor(Math.random() * candidates.length)];
        upgraded = true;
      }
    }
    const luckyStart = finalSpecies.trait?.kind === 'lucky' && Math.random() < 0.20;
    const cost = baseSpecies.seedCost ?? POINT_PRICES.SEED;
    const gameDay = getGameDayKST();
    const ref = doc(db, 'users', uid, 'progress', 'main');

    let outcome: 'ok' | 'nounlock' | 'full' | 'limit' | 'poor' | 'noprog' = 'noprog';
    let remaining = 0;
    inFlight.add(key);
    try {
      await runTransaction(db, async (tx) => {
        outcome = 'noprog';
        const snap = await tx.get(ref);
        if (!snap.exists()) return;
        const p = snap.data() as ProgressDoc;
        const gs = p.gardenState;
        if (!gs.unlockedSpecies.includes(speciesId)) { outcome = 'nounlock'; return; }
        if (gs.plants.length >= MAX_BEDS * PLANTS_PER_BED) { outcome = 'full'; return; }
        const prevStats = p.gardenStats ?? {};
        const todayPlanted = prevStats.dailyDirectPlantsDate === gameDay ? (prevStats.dailyDirectPlants ?? 0) : 0;
        if (todayPlanted >= DAILY_PLANT_LIMIT) { outcome = 'limit'; return; }
        if ((p.spendablePoints ?? 0) < cost) { outcome = 'poor'; return; }

        const unlocked = gs.unlockedSpecies;
        const prevCodex = prevStats.codexEntries ?? [];
        const nextCodex = (finalSpecies.rarity === 'transcendent' || prevCodex.includes(finalSpecies.id))
          ? prevCodex : [...prevCodex, finalSpecies.id];
        const nextRareDrops = (prevStats.rareDropsTriggered ?? 0) + (upgraded ? 1 : 0);
        const nextUnlockedSpecies = (upgraded && !unlocked.includes(finalSpecies.id))
          ? [...unlocked, finalSpecies.id] : unlocked;
        const nextTodayPlanted = todayPlanted + 1;
        remaining = DAILY_PLANT_LIMIT - nextTodayPlanted;
        const newPlant: PlantInstance = {
          id:        `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          speciesId: finalSpecies.id,
          stage:     luckyStart ? 1 : 0,
          plantedAt: Timestamp.now() as any,
        };
        const newPlants = [...gs.plants, newPlant];

        tx.set(ref, {
          spendablePoints: increment(-cost),
          gardenState: { ...gs, plants: newPlants, unlockedSpecies: nextUnlockedSpecies },
          gardenStats: {
            ...prevStats,
            codexEntries: nextCodex,
            rareDropsTriggered: nextRareDrops,
            dailyDirectPlants: nextTodayPlanted,
            dailyDirectPlantsDate: gameDay,
          },
          updatedAt: serverTimestamp(),
        }, { merge: true });
        tx.set(doc(collection(db, 'users', uid, 'pointLedger')), {
          delta: -cost, reason: upgraded ? 'spend_plant_rare_drop' : 'spend_plant', refId: finalSpecies.id,
          createdAt: serverTimestamp(),
        });
        outcome = 'ok';
      });
    } catch (e) {
      toast.error('저장 실패: ' + (e as Error).message);
      return;
    } finally {
      inFlight.delete(key);
    }

    if (outcome === 'nounlock') { toast.error('해금되지 않은 식물입니다.'); return; }
    if (outcome === 'full')     { toast.error(`화단은 최대 ${MAX_BEDS}개(${MAX_BEDS * PLANTS_PER_BED}칸)까지만 사용할 수 있습니다.`); return; }
    if (outcome === 'limit')    { toast.error(`오늘 직접 심기는 ${DAILY_PLANT_LIMIT}회까지입니다. 내일 04:00에 초기화됩니다.`); return; }
    if (outcome === 'poor')     { toast.error(`포인트가 부족합니다. (필요: ${cost}P)`); return; }
    if (outcome !== 'ok') return;

    const countMsg = remaining > 0 ? ` · 오늘 ${remaining}회 남음` : ' · 오늘 마지막!';
    if (upgraded) {
      toast(`🌟 희귀 씨앗 발견! ${finalSpecies.name} 가 자랐어요! (-${cost}P)${countMsg}`);
    } else if (luckyStart) {
      toast(`🍀 ${finalSpecies.name} — 행운! 새싹부터 시작! (-${cost}P)${countMsg}`);
    } else {
      toast(`🌱 ${finalSpecies.name} 씨앗을 심었습니다! (-${cost}P)${countMsg}`);
    }
  };

  const waterPlant = async (plantId: string): Promise<boolean> => {
    if (!uid) return false;
    const key = `water:${plantId}`;
    if (inFlight.has(key)) return false;
    const cost = POINT_PRICES.WATER;
    const ref = doc(db, 'users', uid, 'progress', 'main');

    let outcome: 'ok' | 'poor' | 'watered' | 'noplant' | 'noprog' = 'noprog';
    inFlight.add(key);
    try {
      await runTransaction(db, async (tx) => {
        outcome = 'noprog';
        const snap = await tx.get(ref);
        if (!snap.exists()) return;
        const p = snap.data() as ProgressDoc;
        const plant = p.gardenState.plants.find((pl) => pl.id === plantId);
        if (!plant) { outcome = 'noplant'; return; }
        if (plant.wateredAt && isWateredToday(plant.wateredAt as any)) { outcome = 'watered'; return; }
        if ((p.spendablePoints ?? 0) < cost) { outcome = 'poor'; return; }
        const plants = p.gardenState.plants.map((pl) => {
          if (pl.id !== plantId) return pl;
          const species = PLANT_SPECIES.find((s) => s.id === pl.speciesId);
          const maxStage = (species?.stages ?? 4) - 1;
          return { ...pl, stage: Math.min(pl.stage + 1, maxStage), witheredSince: undefined, wateredAt: Timestamp.now() as any };
        });
        tx.set(ref, {
          spendablePoints: increment(-cost),
          gardenState: { ...p.gardenState, plants },
          updatedAt: serverTimestamp(),
        }, { merge: true });
        tx.set(doc(collection(db, 'users', uid, 'pointLedger')), {
          delta: -cost, reason: 'spend_water', refId: plantId, createdAt: serverTimestamp(),
        });
        outcome = 'ok';
      });
    } catch (e) {
      toast.error('저장 실패: ' + (e as Error).message);
      return false;
    } finally {
      inFlight.delete(key);
    }

    if (outcome === 'poor')    { toast.error(`포인트가 부족합니다. (필요: ${cost}P)`); return false; }
    if (outcome === 'watered') { toast.error('오늘은 이미 물을 줬습니다. 내일 다시 시도하세요.'); return false; }
    return outcome === 'ok';
  };

  const unlockSpecies = async (speciesId: string) => {
    if (!uid) return;
    const key = `unlock:${speciesId}`;
    if (inFlight.has(key)) return;
    const species = PLANT_SPECIES.find((s) => s.id === speciesId);
    if (!species || species.unlockCost === 0) return;
    const cost = species.unlockCost;
    const ref = doc(db, 'users', uid, 'progress', 'main');

    let outcome: 'ok' | 'already' | 'poor' | 'noprog' = 'noprog';
    let nextCodexLen = 0;
    inFlight.add(key);
    try {
      await runTransaction(db, async (tx) => {
        outcome = 'noprog';
        const snap = await tx.get(ref);
        if (!snap.exists()) return;
        const p = snap.data() as ProgressDoc;
        if (p.gardenState.unlockedSpecies.includes(speciesId)) { outcome = 'already'; return; }
        if ((p.spendablePoints ?? 0) < cost) { outcome = 'poor'; return; }
        const unlockedSpecies = [...p.gardenState.unlockedSpecies, speciesId];
        const prevStats = p.gardenStats ?? {};
        const prevCodex = prevStats.codexEntries ?? [];
        const nextCodex = (species.rarity === 'transcendent' || prevCodex.includes(speciesId))
          ? prevCodex : [...prevCodex, speciesId];
        nextCodexLen = nextCodex.length;
        tx.set(ref, {
          spendablePoints: increment(-cost),
          gardenState: { ...p.gardenState, unlockedSpecies },
          gardenStats: { ...prevStats, codexEntries: nextCodex },
          updatedAt: serverTimestamp(),
        }, { merge: true });
        tx.set(doc(collection(db, 'users', uid, 'pointLedger')), {
          delta: -cost, reason: 'unlock_species', refId: speciesId, createdAt: serverTimestamp(),
        });
        outcome = 'ok';
      });
    } catch (e) {
      toast.error('저장 실패: ' + (e as Error).message);
      return;
    } finally {
      inFlight.delete(key);
    }

    if (outcome === 'already') { toast('이미 해금된 식물입니다.'); return; }
    if (outcome === 'poor')    { toast.error(`포인트가 부족합니다. (필요: ${cost}P)`); return; }
    if (outcome !== 'ok') return;
    if (species.rarity === 'transcendent') {
      toast(`✨ ${species.name} 해금! 초월의 식물을 맞이했습니다.`);
    } else {
      toast(`🌿 ${species.name} 해금! 도감 ${nextCodexLen}/${CODEX_SPECIES_COUNT}`);
    }
  };

  const harvestPlant = async (plantId: string) => {
    if (!uid) return;
    const key = `harvest:${plantId}`;
    if (inFlight.has(key)) return;
    const ref = doc(db, 'users', uid, 'progress', 'main');

    let outcome: 'ok' | 'noplant' | 'notripe' | 'noprog' = 'noprog';
    let tName = '';
    let tYield = 0;
    let tStreakBonus = 0;
    let tStar3 = 0;
    let tMilestone: string | null = null;
    let tCount = 0;
    inFlight.add(key);
    try {
      await runTransaction(db, async (tx) => {
        outcome = 'noprog';
        const snap = await tx.get(ref);
        if (!snap.exists()) return;
        const p = snap.data() as ProgressDoc;
        const plant = p.gardenState.plants.find((pl) => pl.id === plantId);
        if (!plant) { outcome = 'noplant'; return; }
        const species = PLANT_SPECIES.find((s) => s.id === plant.speciesId);
        if (!species) { outcome = 'noplant'; return; }
        const maxStage = (species.stages ?? 4) - 1;
        if (plant.stage < maxStage) { outcome = 'notripe'; return; }

        // 수확량 계산
        const prevStats = p.gardenStats ?? {};
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

        const streakBonus = (species.trait?.kind === 'streakSync' && (p.prayerStreak ?? 0) > 0)
          ? Math.round(baseAdjusted * 0.5) : 0;
        const totalYield = baseAdjusted + rarityBonus + streakBonus;

        // 연꽃·고사리·달꽃(healer) 트레잇: 정원 생기 회복
        let nextHealth = p.gardenState.health ?? 100;
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

        const newPlants = p.gardenState.plants.filter((pl) => pl.id !== plantId);

        tx.set(ref, {
          spendablePoints: increment(totalYield),
          totalPoints: increment(totalYield),
          gardenState: { ...p.gardenState, plants: newPlants, health: nextHealth },
          gardenStats: {
            ...prevStats,
            harvestsBySpecies: nextHarvestsBySpecies,
            harvestsByRarity: nextHarvestsByRarity,
          },
          updatedAt: serverTimestamp(),
        }, { merge: true });
        tx.set(doc(collection(db, 'users', uid, 'pointLedger')), {
          delta: totalYield, reason: 'harvest_plant', refId: plantId, createdAt: serverTimestamp(),
        });

        tName = species.name; tYield = totalYield; tStreakBonus = streakBonus;
        tStar3 = star3Bonus; tMilestone = milestone; tCount = newCount;
        outcome = 'ok';
      });
    } catch (e) {
      toast.error('저장 실패: ' + (e as Error).message);
      return;
    } finally {
      inFlight.delete(key);
    }

    if (outcome === 'notripe') { toast.error('아직 만개하지 않았습니다.'); return; }
    if (outcome !== 'ok') return;

    const bonusLabel = [
      tStreakBonus ? '기도 보너스 ✨' : '',
      tStar3 ? '★3 +10%' : '',
    ].filter(Boolean).join(' · ');
    toast(`🌾 ${tName} 수확! +${tYield}P${bonusLabel ? ` (${bonusLabel})` : ''}`);
    if (tMilestone) {
      toast(`⭐ ${tName} ${tCount}회 수확 — ${tMilestone} 달성!`);
    }
  };

  const digUpPlant = async (plantId: string) => {
    if (!uid) return;
    const key = `dig:${plantId}`;
    if (inFlight.has(key)) return;
    const ref = doc(db, 'users', uid, 'progress', 'main');

    let outcome: 'ok' | 'noplant' | 'noprog' = 'noprog';
    let tName = '식물';
    inFlight.add(key);
    try {
      await runTransaction(db, async (tx) => {
        outcome = 'noprog';
        const snap = await tx.get(ref);
        if (!snap.exists()) return;
        const p = snap.data() as ProgressDoc;
        const plant = p.gardenState.plants.find((pl) => pl.id === plantId);
        if (!plant) { outcome = 'noplant'; return; }
        const species = PLANT_SPECIES.find((s) => s.id === plant.speciesId);
        tName = species?.name ?? '식물';
        const newPlants = p.gardenState.plants.filter((pl) => pl.id !== plantId);
        const prevStats = p.gardenStats ?? {};
        tx.set(ref, {
          gardenState: { ...p.gardenState, plants: newPlants },
          gardenStats: {
            ...prevStats,
            plantsLost: (prevStats.plantsLost ?? 0) + 1,
          },
          updatedAt: serverTimestamp(),
        }, { merge: true });
        outcome = 'ok';
      });
    } catch (e) {
      toast.error('저장 실패: ' + (e as Error).message);
      return;
    } finally {
      inFlight.delete(key);
    }

    if (outcome === 'ok') toast(`🪴 ${tName}을(를) 파냈습니다.`);
  };

  return { plantSeed, waterPlant, unlockSpecies, harvestPlant, digUpPlant };
}
