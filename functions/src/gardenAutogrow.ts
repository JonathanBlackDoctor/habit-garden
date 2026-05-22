/**
 * gardenAutogrow — 정원 자동 성장/생기/시들기 로직 격리
 *
 * 다른 트리거(awardEngine, prayerAward, dailyReset)에서 1줄 호출로 사용.
 * 정원 게임화 변경은 모두 이 파일에 모여 동기부여 알고리즘 작업의 변경과
 * 머지 충돌 면적을 최소화한다.
 */
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import {
  PLANT_SPECIES,
  type ProgressDoc,
  type PlantInstance,
  type PlantSpecies,
} from '../../shared/types/firestore';

const db = admin.firestore();

function speciesOf(id: string): PlantSpecies | undefined {
  return PLANT_SPECIES.find((s) => s.id === id);
}

function maxStageOf(speciesId: string): number {
  return (speciesOf(speciesId)?.stages ?? 4) - 1;
}

/** 정원의 식물 중 미만개 식물 1개를 랜덤하게 +1 단계 성장시킨다. */
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

  await ref.set({
    gardenState: { ...prog.gardenState, plants: next },
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
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
 *  - 어제 success ? health +3, streak 보너스 시드 검토
 *  -          아니 ? health -10, 시들기 후보 처리
 *  - 종별 트레잇 적용 (fast=대나무 자동 성장, beauty=장미 XP)
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

  // 1) 트레잇 적용
  plants = plants.map((p) => {
    const sp = speciesOf(p.speciesId);
    if (!sp) return p;
    const max = (sp.stages ?? 4) - 1;
    // 대나무: 생기>80 + 미만개면 +1 성장
    if (sp.trait?.kind === 'fast' && health > 80 && p.stage < max) {
      return { ...p, stage: p.stage + 1, witheredSince: undefined };
    }
    return p;
  });

  // 장미(beauty) 트레잇: 정원에 있는 각 장미가 매일 XP 가산
  for (const p of plants) {
    const sp = speciesOf(p.speciesId);
    if (sp?.trait?.kind === 'beauty') {
      xpInLevel += sp.trait.xp;
      xpBumped = true;
    }
  }

  // 2) health 변동
  if (yesterdaySuccess) {
    health = Math.min(100, health + 3);
  } else {
    health = Math.max(0, health - 10);
  }

  // 3) 생기 낮음(0~50) → 시들기 후보 1개 (hardy 면역)
  if (health <= 50 && plants.length > 0) {
    const candidates = plants
      .map((p, idx) => ({ p, idx, sp: speciesOf(p.speciesId) }))
      .filter(({ p, sp }) => !p.witheredSince && sp?.trait?.kind !== 'hardy');
    if (candidates.length > 0) {
      // stage 가 낮은 식물 우선
      candidates.sort((a, b) => a.p.stage - b.p.stage);
      const target = candidates[0].idx;
      plants = plants.map((p, idx) =>
        idx === target ? { ...p, witheredSince: admin.firestore.Timestamp.now() as any } : p,
      );
    }
  }

  // 4) 성공일 + globalStreak 7의 배수 → 보너스 클로버 시드 자동 심기
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

  const patch: any = {
    gardenState: { ...garden, plants, health },
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (xpBumped) patch.xpInLevel = xpInLevel;

  await ref.set(patch, { merge: true });
}
