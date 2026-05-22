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
  type ProgressDoc,
  type PlantInstance,
  type PlantSpecies,
  type GardenStats,
} from '../../shared/types/firestore';

const db = admin.firestore();

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
export async function processDailyGarden(uid: string, yesterdaySuccess: boolean): Promise<void> {
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
    // fast (대나무·민트·등): health>80 일 때 +1
    if (sp.trait?.kind === 'fast' && health > 80) {
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

  // 3) health 변동
  if (yesterdaySuccess) {
    health = Math.min(100, health + 3);
  } else {
    health = Math.max(0, health - 10);
  }

  // 4) 시들기 후보 (health 낮을 때 + hardy 면역)
  if (health <= 50 && plants.length > 0) {
    const candidates = plants
      .map((p, idx) => ({ p, idx, sp: speciesOf(p.speciesId) }))
      .filter(({ p, sp }) => !p.witheredSince && sp?.trait?.kind !== 'hardy');
    if (candidates.length > 0) {
      candidates.sort((a, b) => a.p.stage - b.p.stage);
      const target = candidates[0].idx;
      plants = plants.map((p, idx) =>
        idx === target ? { ...p, witheredSince: admin.firestore.Timestamp.now() as any } : p,
      );
    }
  }

  // 5) 스트릭 보너스 시드 (7일 배수)
  const streak = prog.globalStreak ?? 0;
  if (yesterdaySuccess && streak > 0 && streak % 7 === 0 && plants.length < 30) {
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
  if (passiveYield > 0) {
    patch.spendablePoints = FieldValue.increment(passiveYield);
    patch.totalPoints     = FieldValue.increment(passiveYield);
  }
  await ref.set(patch, { merge: true });

  // 10) passive yield ledger
  if (passiveYield > 0) {
    await db.collection(`users/${uid}/pointLedger`).add({
      delta: passiveYield,
      reason: 'passive_yield',
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

  // first_bloom: 만개한 식물이 한 그루라도 있으면
  if (plants.some((p) => p.stage >= maxStageOf(p.speciesId))) {
    await grantBadgeIfNew(uid, 'first_bloom', 0);
  }

  // collector_5 / 10 / 15 / 20 / 25 — 해금 수 기준
  const unlockCount = unlocked.length;
  if (unlockCount >= 5)  await grantBadgeIfNew(uid, 'collector',     50);
  if (unlockCount >= 10) await grantBadgeIfNew(uid, 'collector_10',  150);
  if (unlockCount >= 15) await grantBadgeIfNew(uid, 'collector_15',  400);
  if (unlockCount >= 20) await grantBadgeIfNew(uid, 'collector_20',  1000);
  if (unlockCount >= 25) await grantBadgeIfNew(uid, 'collector_25',  3000);

  // codex 25/25
  if (codex.length >= 25) {
    await grantBadgeIfNew(uid, 'codex_complete', 5000);
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
