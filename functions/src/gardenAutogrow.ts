/**
 * gardenAutogrow — 정원 자동 성장/생기/시들기/passive yield/배지 부여 로직 격리
 *
 * 다른 트리거(awardEngine, prayerAward, dailyReset)에서 1줄 호출로 사용.
 * 정원 게임화 변경은 모두 이 파일에 모여 동기부여 알고리즘 작업의 변경과
 * 머지 충돌 면적을 최소화한다.
 */
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import {
  PLANT_SPECIES,
  DAILY_YIELD_BY_RARITY,
  POINT_PRICES,
  BADGE_DEFS,
  MAX_GARDEN_PLANTS,
  type ProgressDoc,
  type PlantInstance,
  type PlantSpecies,
  type GardenStats,
} from '../../shared/types/firestore';
import { applyLevelUps } from './levelEngine';

const db = admin.firestore();

// 연약 전설 trait — 게을러진 날 시듦/죽음을 자체 처리하므로 일반 시들기 후보에서 제외한다.
const FRAGILE_TRAIT_KINDS = new Set(['brittle', 'fragile', 'waning', 'regress', 'radiant']);

function speciesOf(id: string): PlantSpecies | undefined {
  return PLANT_SPECIES.find((s) => s.id === id);
}

function maxStageOf(speciesId: string): number {
  return (speciesOf(speciesId)?.stages ?? 4) - 1;
}

function dailyYieldOf(sp: PlantSpecies): number {
  return sp.dailyYield ?? DAILY_YIELD_BY_RARITY[sp.rarity];
}

/** 정원의 식물 중 미만개 식물 1개를 랜덤하게 +1 단계 성장 + autogrow 카운트 */
export async function growRandomPlant(uid: string, chance = 1.0): Promise<void> {
  if (chance < 1.0 && Math.random() > chance) return;

  const ref = db.doc(`users/${uid}/progress/main`);
  const snap = await ref.get();
  if (!snap.exists) return;
  const prog = snap.data() as ProgressDoc;
  const plants = prog.gardenState?.plants ?? [];
  if (plants.length === 0) return;

  const eligible = plants
    .map((p, idx) => ({ p, idx, max: maxStageOf(p.speciesId) }))
    .filter(({ p, max }) => p.stage < max);
  if (eligible.length === 0) return;

  const pick = eligible[Math.floor(Math.random() * eligible.length)];
  const next = plants.map((p, idx) =>
    idx === pick.idx ? { ...p, stage: p.stage + 1, witheredSince: undefined } : p,
  );

  // 자동 성장 카운터
  const stats = prog.gardenStats ?? {};
  const autogrowToday = (stats.autogrowToday ?? 0) + 1;
  const autogrowTotal = (stats.autogrowTotal ?? 0) + 1;

  await ref.set({
    gardenState: { ...prog.gardenState, plants: next },
    gardenStats: { ...stats, autogrowToday, autogrowTotal },
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  // autogrow 50회 배지 (도달 시점에 한 번)
  if (autogrowTotal === 50) {
    await grantBadgeIfNew(uid, 'autogrow_50', 100);
  }
}

/** 정원 생기(health) 가산 (0~100 클램프). */
export async function bumpGardenHealth(uid: string, delta: number): Promise<void> {
  const ref = db.doc(`users/${uid}/progress/main`);
  const snap = await ref.get();
  if (!snap.exists) return;
  const prog = snap.data() as ProgressDoc;
  const cur = prog.gardenState?.health ?? 100;
  const next = Math.max(0, Math.min(100, cur + delta));
  if (next === cur) return;

  await ref.set({
    gardenState: { ...prog.gardenState, health: next },
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

/**
 * 일일 처리 (dailyReset 에서 사용자별 호출).
 *  - 트레잇 적용: fast(대나무·민트), beauty(장미·데이지·수국), bloomer(생명나무)
 *  - 만개 식물에 대해 passive yield 지급
 *  - health 변동, 시들기 후보, 7-day 스트릭 보너스 시드
 *  - autogrowToday 0 리셋
 *  - consecutiveHealthyDays 갱신
 *  - 배지 자동 부여 (rarity 챌린지·collector 등급·codex·health·rare drop)
 */
export async function processDailyGarden(
  uid: string,
  yesterdaySuccess: boolean,
  protectedDay = false,
): Promise<void> {
  const ref = db.doc(`users/${uid}/progress/main`);
  const snap = await ref.get();
  if (!snap.exists) return;
  const prog = snap.data() as ProgressDoc;
  const garden = prog.gardenState;
  if (!garden) return;

  let health = garden.health ?? 100;
  let plants: PlantInstance[] = [...(garden.plants ?? [])];
  let xpInLevel = prog.xpInLevel ?? 0;
  let xpBumped = false;
  let stats: GardenStats = { ...(prog.gardenStats ?? {}) };

  // 1) 트레잇 적용 (성장 계열): fast + bloomer
  plants = plants.map((p) => {
    const sp = speciesOf(p.speciesId);
    if (!sp) return p;
    const max = (sp.stages ?? 4) - 1;
    if (p.stage >= max) return p;
    // bloomer (생명나무): 항상 +1 (health 무관)
    if (sp.trait?.kind === 'bloomer') {
      return { ...p, stage: p.stage + 1, witheredSince: undefined };
    }
    // transcendent (초월): 살아있으면 매일 한 단계씩 자라 만개에 이른다 (health 무관)
    if (sp.trait?.kind === 'transcendent') {
      return { ...p, stage: p.stage + 1, witheredSince: undefined };
    }
    // fast (대나무·민트·등): health>=80 일 때 +1 (생기 80 이상)
    if (sp.trait?.kind === 'fast' && health >= 80) {
      return { ...p, stage: p.stage + 1, witheredSince: undefined };
    }
    return p;
  });

  // beauty 트레잇: 정원에 있는 식물별 XP 가산
  for (const p of plants) {
    const sp = speciesOf(p.speciesId);
    if (sp?.trait?.kind === 'beauty') {
      xpInLevel += sp.trait.xp;
      xpBumped = true;
    }
  }

  // 2) Passive Yield: 만개 식물의 dailyYield 합산
  let passiveYield = 0;
  for (const p of plants) {
    const sp = speciesOf(p.speciesId);
    if (!sp) continue;
    const max = (sp.stages ?? 4) - 1;
    if (p.stage >= max && !p.witheredSince) {
      passiveYield += dailyYieldOf(sp);
    }
  }

  // 3) health 변동 (보호된 날은 중립 — 실패 페널티 없음)
  if (yesterdaySuccess) {
    health = Math.min(100, health + 3);
  } else if (!protectedDay) {
    health = Math.max(0, health - 10);
  }

  let plantsLost = 0;

  // 4.4) 초월(transcendent) 처리: 고유 효과 적용 + 유지비 차감 + 죽음 판정
  //   살아있는 동안만 효과를 주고 유지비를 낸다. 하루 실패(보호 안 됨)면 즉시 스러지고,
  //   유지비를 못 내면 굶어 죽는다. guardian 효과는 아래 연약 전설 죽음을 1회 막는 슬롯이 된다.
  let guardianSlots = 0;
  let totalUpkeep = 0;
  let budget = prog.spendablePoints ?? 0;
  {
    const survivors: PlantInstance[] = [];
    for (const p of plants) {
      const sp = speciesOf(p.speciesId);
      const trait = sp?.trait;
      if (trait?.kind !== 'transcendent') { survivors.push(p); continue; }
      // 유지비 미납 → 굶어 죽음
      if (budget < trait.upkeep) { plantsLost++; continue; }
      // 게으른 하루(보호 안 됨) → 즉시 죽음 (유지비 차감 없음)
      if (!yesterdaySuccess && !protectedDay) { plantsLost++; continue; }
      // 생존: 유지비 차감 + 일일 경험치(유지비에 상응) + 종별 고유 보조 효과
      budget -= trait.upkeep;
      totalUpkeep += trait.upkeep;
      if (trait.dailyXp > 0) {
        xpInLevel += trait.dailyXp;
        xpBumped = true;
      }
      if (trait.effect === 'vitality') {
        health = Math.min(100, health + trait.amount);
      } else if (trait.effect === 'guardian') {
        guardianSlots += trait.amount;
      }
      survivors.push(p);
    }
    plants = survivors;
  }

  // 4) 시들기 후보 (health 낮을 때 + hardy 면역 + 연약 전설·초월은 자체 처리하므로 제외)
  if (health <= 50 && plants.length > 0) {
    const candidates = plants
      .map((p, idx) => ({ p, idx, sp: speciesOf(p.speciesId) }))
      .filter(({ p, sp }) =>
        !p.witheredSince &&
        sp?.trait?.kind !== 'hardy' &&
        sp?.rarity !== 'transcendent' &&
        !(sp?.trait && FRAGILE_TRAIT_KINDS.has(sp.trait.kind)),
      );
    if (candidates.length > 0) {
      candidates.sort((a, b) => a.p.stage - b.p.stage);
      const target = candidates[0].idx;
      plants = plants.map((p, idx) =>
        idx === target ? { ...p, witheredSince: admin.firestore.Timestamp.now() as any } : p,
      );
    }
  }

  // 4.5) 연약 전설 trait: 게으른 날 시듦/죽음, 성실한 날 회복
  //   화려한 대신 매일 성실하지 않으면 쉽게 죽는다(영구 제거). 식물마다 방식이 다르다.
  plants = plants.flatMap((p): PlantInstance[] => {
    const sp = speciesOf(p.speciesId);
    const kind = sp?.trait?.kind;
    if (!kind || !FRAGILE_TRAIT_KINDS.has(kind)) return [p];
    const max = (sp!.stages ?? 4) - 1;

    if (yesterdaySuccess) {
      // 성실한 하루: 카운터 리셋 + 회복 (radiant 는 시들지 않으므로 그대로)
      const recovered: PlantInstance = { ...p, neglectStreak: 0 };
      if (kind !== 'radiant') recovered.witheredSince = undefined;
      return [recovered];
    }

    // 보호된 날(휴가/그레이스/freeze 토큰): 죽음·시듦 없이 그대로 생존
    if (protectedDay) return [p];

    // 게으른 하루
    const neglectStreak = (p.neglectStreak ?? 0) + 1;
    const now = admin.firestore.Timestamp.now() as any;
    // 죽을 운명이면 guardian(은하백합) 슬롯으로 1회 구제 — 슬롯 1 소모, 그날은 생존.
    const tryGuard = (): PlantInstance[] | null => {
      if (guardianSlots <= 0) return null;
      guardianSlots--;
      const saved: PlantInstance = { ...p, neglectStreak: 0 };
      if (kind !== 'radiant') saved.witheredSince = undefined;
      return [saved];
    };
    switch (kind) {
      case 'brittle': {
        // 단 하루도 못 거른다 → 즉시 죽음
        const g = tryGuard(); if (g) return g;
        plantsLost++;
        return [];
      }
      case 'fragile':
        // 시든 채 또 거르면 죽음, 아니면 시듦
        if (p.witheredSince) { const g = tryGuard(); if (g) return g; plantsLost++; return []; }
        return [{ ...p, neglectStreak, witheredSince: now }];
      case 'waning': {
        // graceDays 연속 거르면 죽음
        const grace = (sp!.trait as { kind: 'waning'; graceDays: number }).graceDays;
        if (neglectStreak >= grace) { const g = tryGuard(); if (g) return g; plantsLost++; return []; }
        return [{ ...p, neglectStreak, witheredSince: now }];
      }
      case 'regress':
        // 거른 날마다 한 단계 시듦, stage 0 에서 또 거르면 죽음
        if (p.stage <= 0) { const g = tryGuard(); if (g) return g; plantsLost++; return []; }
        return [{ ...p, neglectStreak, stage: p.stage - 1, witheredSince: now }];
      case 'radiant':
        // 평소 시들지 않음. 만개(최고 stage)의 영광을 거르면 즉시 죽음
        if (p.stage >= max) { const g = tryGuard(); if (g) return g; plantsLost++; return []; }
        return [{ ...p, neglectStreak }];
      default:
        return [p];
    }
  });
  if (plantsLost > 0) {
    stats.plantsLost = (stats.plantsLost ?? 0) + plantsLost;
  }

  // 5) 스트릭 보너스 시드 (7일 배수)
  const streak = prog.globalStreak ?? 0;
  if (yesterdaySuccess && streak > 0 && streak % 7 === 0 && plants.length < MAX_GARDEN_PLANTS) {
    const unlocked = garden.unlockedSpecies ?? [];
    const giftId = unlocked.includes('clover') ? 'clover' : 'sprout';
    plants.push({
      id: `streak-${Date.now()}`,
      speciesId: giftId,
      stage: 0,
      plantedAt: admin.firestore.Timestamp.now() as any,
    });
  }

  // 6) consecutiveHealthyDays 갱신
  const wasHealthy = health >= 80;
  const consecutiveHealthyDays = wasHealthy ? (stats.consecutiveHealthyDays ?? 0) + 1 : 0;
  stats.consecutiveHealthyDays = consecutiveHealthyDays;

  // 7) autogrowToday 0 리셋
  stats.autogrowToday = 0;

  // 8) passiveYieldTotal 누적
  stats.passiveYieldTotal = (stats.passiveYieldTotal ?? 0) + passiveYield;

  // 9) 일괄 저장 (progress + passive yield)
  const patch: any = {
    gardenState: { ...garden, plants, health },
    gardenStats: stats,
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (xpBumped) patch.xpInLevel = xpInLevel;
  // 순포인트 = passive yield − 초월 유지비. totalPoints(누적 획득)는 수익만 반영.
  const netPoints = passiveYield - totalUpkeep;
  if (netPoints !== 0) {
    patch.spendablePoints = FieldValue.increment(netPoints);
  }
  if (passiveYield > 0) {
    patch.totalPoints = FieldValue.increment(passiveYield);
  }
  await ref.set(patch, { merge: true });

  // 9.5) beauty·초월 트레잇 XP로 레벨 기준을 넘었으면 레벨업·보상 처리
  if (xpBumped) {
    await applyLevelUps(uid);
  }

  // 10) passive yield ledger
  if (passiveYield > 0) {
    await db.collection(`users/${uid}/pointLedger`).add({
      delta: passiveYield,
      reason: 'passive_yield',
      refId: 'daily',
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  // 10.5) 초월 유지비 ledger
  if (totalUpkeep > 0) {
    await db.collection(`users/${uid}/pointLedger`).add({
      delta: -totalUpkeep,
      reason: 'transcendent_upkeep',
      refId: 'daily',
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  // 11) 배지 자동 부여 (성능 위해 한 번에 검사)
  await checkGardenBadges(uid, prog, stats, plants);
}

/** 정원 관련 배지 자동 부여 — 임계점 도달 시 1회만 grant. */
async function checkGardenBadges(
  uid: string,
  prog: ProgressDoc,
  stats: GardenStats,
  plants: PlantInstance[],
): Promise<void> {
  const unlocked = prog.gardenState?.unlockedSpecies ?? [];
  const codex = stats.codexEntries ?? [];
  const harvestsByRarity = stats.harvestsByRarity ?? {};
  const consecutiveHealthy = stats.consecutiveHealthyDays ?? 0;
  const rareDrops = stats.rareDropsTriggered ?? 0;

  // 초월(transcendent)은 컬렉션/도감 완성 집계에서 제외 — 별도 프레스티지 티어.
  const isTranscendent = (id: string) => speciesOf(id)?.rarity === 'transcendent';

  // first_bloom: 만개한 식물이 한 그루라도 있으면
  if (plants.some((p) => p.stage >= maxStageOf(p.speciesId))) {
    await grantBadgeIfNew(uid, 'first_bloom', 0);
  }

  // collector_5 / 10 / 15 / 20 / 25 — 해금 수 기준 (초월 제외)
  const unlockCount = unlocked.filter((id) => !isTranscendent(id)).length;
  if (unlockCount >= 5)  await grantBadgeIfNew(uid, 'collector',     50);
  if (unlockCount >= 10) await grantBadgeIfNew(uid, 'collector_10',  150);
  if (unlockCount >= 15) await grantBadgeIfNew(uid, 'collector_15',  400);
  if (unlockCount >= 20) await grantBadgeIfNew(uid, 'collector_20',  1000);
  if (unlockCount >= 25) await grantBadgeIfNew(uid, 'collector_25',  3000);

  // codex 25/25 (초월 제외)
  if (codex.filter((id) => !isTranscendent(id)).length >= 25) {
    await grantBadgeIfNew(uid, 'codex_complete', 5000);
  }

  // 초월의 수호자: 초월 식물을 보유 중이면
  if (plants.some((p) => isTranscendent(p.speciesId))) {
    await grantBadgeIfNew(uid, 'transcendent_keeper', 0);
  }

  // 수확 챌린지
  const rareOrMore = (harvestsByRarity.rare ?? 0) + (harvestsByRarity.epic ?? 0) + (harvestsByRarity.legendary ?? 0);
  if (rareOrMore >= 10)                       await grantBadgeIfNew(uid, 'harvest_rare_10', 200);
  if ((harvestsByRarity.epic ?? 0) >= 5)      await grantBadgeIfNew(uid, 'harvest_epic_5', 500);
  if ((harvestsByRarity.legendary ?? 0) >= 1) await grantBadgeIfNew(uid, 'harvest_legendary_1', 1500);

  // 트레잇 챌린지
  if (rareDrops >= 5) await grantBadgeIfNew(uid, 'rare_drop_5', 300);

  // health 마일스톤
  if (consecutiveHealthy >= 14) await grantBadgeIfNew(uid, 'garden_healthy_14', 50);
}

/** 배지 1회 부여 + 포인트 보상 + ledger. 이미 있으면 스킵. */
async function grantBadgeIfNew(uid: string, badgeId: string, pointReward: number): Promise<void> {
  const badgeRef = db.doc(`users/${uid}/badges/${badgeId}`);
  const snap = await badgeRef.get();
  if (snap.exists) return;
  const def = BADGE_DEFS.find((b) => b.id === badgeId);
  if (!def) return;

  await badgeRef.set({
    badgeId,
    title: def.title,
    tier: def.tier,
    earnedAt: FieldValue.serverTimestamp(),
  });

  if (pointReward > 0) {
    await db.doc(`users/${uid}/progress/main`).set({
      spendablePoints: FieldValue.increment(pointReward),
      totalPoints:     FieldValue.increment(pointReward),
      updatedAt:        FieldValue.serverTimestamp(),
    }, { merge: true });
    await db.collection(`users/${uid}/pointLedger`).add({
      delta: pointReward,
      reason: `badge_${badgeId}`,
      refId: badgeId,
      createdAt: FieldValue.serverTimestamp(),
    });
  }
  // POINT_PRICES 미사용 방지
  void POINT_PRICES;
}
