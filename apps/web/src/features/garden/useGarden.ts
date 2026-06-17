import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp, collection, addDoc, Timestamp, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import { writePublicGarden } from '@/lib/features';
import type { ProgressDoc, PlantInstance, GardenState, DailyGardenRecap } from 'shared/types/firestore';
import { PLANT_SPECIES, POINT_PRICES, CODEX_SPECIES_COUNT, MAX_BEDS, PLANTS_PER_BED, DAILY_PLANT_LIMIT } from 'shared/types/firestore';
import { computePassiveYield, computeYieldBreakdown } from 'shared/lib/gardenYield';
import { toast } from 'sonner';

// 공개 정원 미러 중복 쓰기 방지: uid → 마지막 미러 해시. 모듈 레벨이라 다중 마운트 시 공유된다.
const gardenMirrorCache = new Map<string, string>();

// fast 자동 성장 세션 가드: `${uid}:${gameDay}` 1회만 시도 (Firestore 마커 확정 전 중복 쓰기 방지).
const fastGrowGuard = new Set<string>();

// passive yield 지급 세션 가드: `${uid}:${gameDay}` 1회만 시도 (Firestore 마커 확정 전 중복 쓰기 방지).
const passiveYieldGuard = new Set<string>();

// passive yield 체감 토스트를 띄운 게임일 (localStorage). uid별 1일 1회만 알린다.
function passiveYieldToastKey(uid: string): string {
  return `hg:pyToast:${uid}`;
}

// 미러 변경 감지용 해시 (Timestamp 원본은 비안정 형태라 제외).
function gardenMirrorHash(gs: GardenState, level: number, nickname: string): string {
  const plants = (gs.plants ?? []).map(
    (p) => `${p.id}:${p.speciesId}:${p.stage}:${p.witheredSince ? 1 : 0}`,
  );
  return JSON.stringify({
    plants,
    unlocked: gs.unlockedSpecies ?? [],
    decorations: gs.decorations ?? [],
    health: gs.health ?? 0,
    level,
    nickname,
  });
}

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

/**
 * fast 트레잇(대나무·민트) 생기 자동 성장 — 클라이언트 이중 경로.
 *
 * 원래 이 성장은 매일 04:00 KST 스케줄드 서버 리셋(processDailyGarden)에서만 일어났다.
 * 스케줄드 함수가 누락/지연되면 "생기 80 이상인데 대나무가 안 자라는" 증상이 생긴다.
 * 서버와 동일한 게임일 마커(gardenState.lastFastGrowDate)를 공유해, 둘 중 먼저 도는
 * 쪽이 하루 1회만 성장시키고 마커를 기록한다 → 중복 성장 없이 누락만 보완한다.
 */
function maybeRunFastGrowth(uid: string, data: ProgressDoc): void {
  const garden = data.gardenState;
  if (!garden) return;

  const gameDay = getGameDayKST();
  if (garden.lastFastGrowDate === gameDay) return;   // 오늘 이미 적용됨(서버 또는 클라이언트)
  if ((garden.health ?? 100) < 80) return;            // 생기 80 이상에서만

  const key = `${uid}:${gameDay}`;
  if (fastGrowGuard.has(key)) return;                 // 세션 내 1회

  let grew = false;
  const plants = (garden.plants ?? []).map((p) => {
    const sp = PLANT_SPECIES.find((s) => s.id === p.speciesId);
    if (sp?.trait?.kind !== 'fast') return p;
    const max = (sp.stages ?? 4) - 1;
    if (p.stage >= max) return p;
    grew = true;
    return { ...p, stage: p.stage + 1, witheredSince: undefined };
  });
  if (!grew) return;                                  // 자랄 fast 식물 없음 → 마커도 남기지 않음

  fastGrowGuard.add(key);
  setDoc(
    doc(db, 'users', uid, 'progress', 'main'),
    { gardenState: { ...garden, plants, lastFastGrowDate: gameDay }, updatedAt: serverTimestamp() },
    { merge: true },
  ).catch(() => fastGrowGuard.delete(key));           // 실패 시 다음 스냅샷에서 재시도 허용
}

/**
 * 만개 식물 passive yield 보완 — 클라이언트 이중 경로.
 *
 * 원래 이 지급은 매일 04:00 KST 스케줄드 서버 리셋(processDailyGarden)에서만 일어났다.
 * 스케줄드 함수가 누락/지연되면 "만개한 식물이 있는데 매일 포인트가 안 들어오는" 증상이 생긴다.
 * fast 자동 성장과 마찬가지로, 서버와 게임일 마커(gardenStats.lastPassiveYieldDate)를 공유해
 * 둘 중 먼저 도는 쪽이 하루 1회만 지급하고 마커를 기록한다 → 중복 지급 없이 누락만 보완한다.
 */
function maybeRunPassiveYield(uid: string, data: ProgressDoc): void {
  const garden = data.gardenState;
  if (!garden) return;

  const gameDay = getGameDayKST();
  const stats = data.gardenStats ?? {};
  if (stats.lastPassiveYieldDate === gameDay) return;  // 오늘 이미 지급됨(서버 또는 클라이언트)

  const key = `${uid}:${gameDay}`;
  if (passiveYieldGuard.has(key)) return;              // 세션 내 1회
  passiveYieldGuard.add(key);                          // 0 수익이어도 이번 게임일 재계산 방지

  const amount = computePassiveYield(garden.plants ?? []);
  if (amount <= 0) return;                             // 만개·수익 식물 없음 → 마커도 남기지 않음

  // 서버 정산이 누락된 경우를 대비한 '일부' 정산 요약 — 오늘 번 포인트(식물별)만 채운다.
  // 서버가 같은 게임일에 이미 전체 요약을 남겼다면 덮어쓰지 않는다(부분이 전체를 가리지 않게).
  const health = garden.health ?? 100;
  const partialRecap: DailyGardenRecap = {
    gameDay,
    yesterdaySuccess: false,
    protectedDay: false,
    pointsEarned: amount,
    upkeepPaid: 0,
    xpGained: 0,
    healthBefore: health,
    healthAfter: health,
    grown: 0, bloomed: 0, withered: 0, regressed: 0, lost: 0,
    streakSeed: false,
    plants: computeYieldBreakdown(garden.plants ?? []).map((b) => ({
      plantId: b.plantId, speciesId: b.speciesId, events: [], yield: b.yield,
    })),
    partial: true,
    createdAt: Timestamp.now() as any,
  };
  const writeRecap = stats.lastDailyRecap?.gameDay !== gameDay;

  setDoc(
    doc(db, 'users', uid, 'progress', 'main'),
    {
      spendablePoints: increment(amount),
      totalPoints:     increment(amount),
      gardenStats: {
        ...stats,
        passiveYieldTotal:    (stats.passiveYieldTotal ?? 0) + amount,
        lastPassiveYieldDate: gameDay,
        lastPassiveYieldAmount: amount,
        ...(writeRecap ? { lastDailyRecap: partialRecap } : {}),
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
    .then(() =>
      addDoc(collection(db, 'users', uid, 'pointLedger'), {
        delta: amount, reason: 'passive_yield', refId: 'daily-client',
        createdAt: serverTimestamp(),
      }),
    )
    .catch(() => passiveYieldGuard.delete(key));       // 실패 시 다음 스냅샷에서 재시도 허용
}

/**
 * passive yield 체감 토스트 — 오늘 지급분이 있으면 uid별 1일 1회 알린다.
 * 서버·클라이언트 어느 경로가 지급했든 동일하게 보이도록 마커(lastPassiveYieldDate)만 본다.
 */
function maybeShowPassiveYieldToast(uid: string, data: ProgressDoc): void {
  const stats = data.gardenStats;
  const yieldDate = stats?.lastPassiveYieldDate;
  const amount = stats?.lastPassiveYieldAmount ?? 0;
  if (!yieldDate || amount <= 0) return;
  if (yieldDate !== getGameDayKST()) return;           // 오늘 지급분만 (며칠 지난 값은 알리지 않음)

  let lastSeen: string | null = null;
  try { lastSeen = localStorage.getItem(passiveYieldToastKey(uid)); } catch { /* ignore */ }
  if (lastSeen === yieldDate) return;                  // 이미 오늘 알림

  // 실제로 수익을 내는(만개·미시듦·수익>0) 식물 그루 수 — 초월 등 dailyYield 0 종은 제외.
  const bloomed = (data.gardenState?.plants ?? []).filter(
    (p) => computePassiveYield([p]) > 0,
  ).length;

  try { localStorage.setItem(passiveYieldToastKey(uid), yieldDate); } catch { /* ignore */ }
  toast(`🌷 만개한 식물이 +${amount}P를 벌어다 줬어요!`, {
    description: bloomed > 0 ? `만개 식물 ${bloomed}그루의 하루 수익이 적립됐어요.` : '하루 수익이 적립됐어요.',
    duration: 6000,
    action: {
      label: '정원에서 보기',
      // HashRouter — 해시 변경으로 정원 탭(어젯밤 정원 소식)으로 이동.
      onClick: () => { window.location.hash = '#/garden'; },
    },
  });
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

        // 생기 자동 성장 보완 (스케줄드 서버 리셋 누락 대비) — 서버와 마커 공유로 중복 방지
        maybeRunFastGrowth(uid, data);

        // 만개 식물 passive yield 보완 (스케줄드 리셋 누락 대비) — 서버와 마커 공유로 중복 방지
        maybeRunPassiveYield(uid, data);

        // 오늘 적립된 passive yield 체감 토스트 (서버·클라이언트 어느 경로든 1일 1회)
        maybeShowPassiveYieldToast(uid, data);

        // 공개 정원 미러 (둘러보기) — 닉네임 설정자만, 샌드박스·게스트 제외.
        // 닉네임 미설정 시 gardens/{uid} 문서가 생성되지 않아 둘러보기에 노출되지 않는다.
        const st = useAppStore.getState();
        const nickname = (st.settings?.nickname ?? '').trim();
        if (!st.sandbox && !st.user?.isAnonymous && nickname && data.gardenState) {
          const hash = gardenMirrorHash(data.gardenState, data.level ?? 1, nickname);
          if (gardenMirrorCache.get(uid) !== hash) {
            gardenMirrorCache.set(uid, hash);
            void writePublicGarden({
              uid,
              sandbox: st.sandbox,
              isAnonymous: !!st.user?.isAnonymous,
              nickname,
              level: data.level ?? 1,
              gardenState: data.gardenState,
            });
          }
        }

        // 기존 사용자 1회성 시작 보너스: 한 번도 받지 않은 사용자에 한해 적용.
        // 플래그(starterBonusApplied)가 없는 사용자만 대상 → 사용 후 다시 200P 미만이 되어도 재지급 X.
        if (!data.starterBonusApplied) {
          const needsPoints = (data.spendablePoints ?? 0) < 200;
          const needsPlant  = (data.gardenState?.plants?.length ?? 0) === 0;
          const patch: any = {
            starterBonusApplied: true,
            updatedAt: serverTimestamp(),
          };
          let starterBump = 0;
          if (needsPoints) {
            starterBump = 200 - (data.spendablePoints ?? 0);
            patch.spendablePoints = 200;
            patch.totalPoints = (data.totalPoints ?? 0) + starterBump;
          }
          if (needsPlant) {
            patch.gardenState = {
              ...(data.gardenState ?? { unlockedSpecies: ['sprout'], decorations: [], health: 100 }),
              plants: [{ id: 'starter', speciesId: 'sprout', stage: 1, plantedAt: Timestamp.now() as any }],
            };
          }
          setDoc(doc(db, 'users', uid, 'progress', 'main'), patch, { merge: true });
          // 시작 보너스도 원장에 남겨 포인트 증감 내역이 빠짐없이 추적되게 한다.
          if (starterBump > 0) {
            void addDoc(collection(db, 'users', uid, 'pointLedger'), {
              delta: starterBump, reason: 'starter_bonus', refId: null,
              createdAt: serverTimestamp(),
            });
          }
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
    if (progress.gardenState.plants.length >= MAX_BEDS * PLANTS_PER_BED) {
      toast.error(`화단은 최대 ${MAX_BEDS}개(${MAX_BEDS * PLANTS_PER_BED}칸)까지만 사용할 수 있습니다.`);
      return;
    }
    // 일일 직접 심기 한도 (레벨업 보상 씨앗은 이 카운터를 사용하지 않음)
    const gameDay = getGameDayKST();
    const prevStats = progress.gardenStats ?? {};
    const prevPlantDate = prevStats.dailyDirectPlantsDate ?? '';
    const todayPlanted = prevPlantDate === gameDay ? (prevStats.dailyDirectPlants ?? 0) : 0;
    if (todayPlanted >= DAILY_PLANT_LIMIT) {
      toast.error(`오늘 직접 심기는 ${DAILY_PLANT_LIMIT}회까지입니다. (${todayPlanted}/${DAILY_PLANT_LIMIT}) 내일 04:00에 초기화됩니다.`);
      return;
    }

    const cost = baseSpecies.seedCost ?? POINT_PRICES.SEED;
    if (progress.spendablePoints < cost) {
      toast.error(`포인트가 부족합니다. (필요: ${cost}P)`);
      return;
    }

    // 희귀 씨앗 드롭: 전체 식물 풀에서 한 등급 위 종으로 교체.
    // 무지개붓꽃 등 lucky 트레잇 종은 드롭 확률 1.5×.
    const unlocked = progress.gardenState.unlockedSpecies;
    const rarityRank: Record<string, number> = { basic: 0, common: 1, rare: 2, epic: 3, legendary: 4 };
    const dropChance = baseSpecies.trait?.kind === 'lucky' ? 0.15 : 0.10;
    let finalSpecies = baseSpecies;
    let upgraded = false;
    if (Math.random() < dropChance) {
      const targetRank = rarityRank[baseSpecies.rarity] + 1;
      const candidates = PLANT_SPECIES.filter(
        (s) => rarityRank[s.rarity] === targetRank,
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
    const prevCodex = prevStats.codexEntries ?? [];
    const nextCodex = (finalSpecies.rarity === 'transcendent' || prevCodex.includes(finalSpecies.id))
      ? prevCodex : [...prevCodex, finalSpecies.id];
    const nextRareDrops = (prevStats.rareDropsTriggered ?? 0) + (upgraded ? 1 : 0);
    // 드롭으로 처음 발견한 종은 자동 해금 (이후 직접 심을 수 있도록)
    const nextUnlockedSpecies = (upgraded && !unlocked.includes(finalSpecies.id))
      ? [...unlocked, finalSpecies.id]
      : unlocked;

    const nextTodayPlanted = todayPlanted + 1;
    const remaining = DAILY_PLANT_LIMIT - nextTodayPlanted;

    const newPlants = [...progress.gardenState.plants, newPlant];
    try {
      await setDoc(doc(db, 'users', uid, 'progress', 'main'), {
        spendablePoints: progress.spendablePoints - cost,
        gardenState: { ...progress.gardenState, plants: newPlants, unlockedSpecies: nextUnlockedSpecies },
        gardenStats: {
          ...prevStats,
          codexEntries: nextCodex,
          rareDropsTriggered: nextRareDrops,
          dailyDirectPlants: nextTodayPlanted,
          dailyDirectPlantsDate: gameDay,
        },
        updatedAt: serverTimestamp(),
      }, { merge: true });

      await addDoc(collection(db, 'users', uid, 'pointLedger'), {
        delta: -cost, reason: upgraded ? 'spend_plant_rare_drop' : 'spend_plant', refId: finalSpecies.id,
        createdAt: serverTimestamp(),
      });

      const countMsg = remaining > 0 ? ` · 오늘 ${remaining}회 남음` : ' · 오늘 마지막!';
      if (upgraded) {
        toast(`🌟 희귀 씨앗 발견! ${finalSpecies.name} 가 자랐어요! (-${cost}P)${countMsg}`);
      } else if (luckyStart) {
        toast(`🍀 ${finalSpecies.name} — 행운! 새싹부터 시작! (-${cost}P)${countMsg}`);
      } else {
        toast(`🌱 ${finalSpecies.name} 씨앗을 심었습니다! (-${cost}P)${countMsg}`);
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
    const plant = progress.gardenState.plants.find((p) => p.id === plantId);
    if (plant?.wateredAt && isWateredToday(plant.wateredAt)) {
      toast.error('오늘은 이미 물을 줬습니다. 내일 다시 시도하세요.');
      return false;
    }
    const plants = progress.gardenState.plants.map((p) => {
      if (p.id !== plantId) return p;
      const species = PLANT_SPECIES.find((s) => s.id === p.speciesId);
      const maxStage = (species?.stages ?? 4) - 1;
      return { ...p, stage: Math.min(p.stage + 1, maxStage), witheredSince: undefined, wateredAt: Timestamp.now() as any };
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
