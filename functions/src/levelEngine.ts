/**
 * levelEngine — 레벨업 판정 + 레벨업 보상(포인트·씨앗) 지급을 한곳에 모은다.
 *
 * XP를 올리는 모든 경로(awardEngine·prayerAward·gardenAutogrow)에서 XP 가산 직후
 * applyLevelUps(uid) 1줄을 호출하면 된다. 누적 XP가 여러 레벨을 충족하면 한 번에
 * 모두 처리하고(while), 레벨업 1회마다 보상을 지급한다.
 */
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import {
  LEVELUP_REWARD,
  MAX_GARDEN_PLANTS,
  type ProgressDoc,
  type PlantInstance,
} from '../../shared/types/firestore';
import { resolveLevelUps } from '../../shared/lib/levelRewards';

const db = admin.firestore();

export interface LevelUpResult {
  leveledUp: boolean;
  newLevel: number;
  levelsGained: number;
  pointsAwarded: number;
  seedsAwarded: number;
}

/**
 * 현재 누적 경험치(xpInLevel)를 기준으로 가능한 만큼 레벨업을 처리하고,
 * 레벨업 1회마다 포인트·씨앗 보상을 지급한다. 트랜잭션으로 처리해
 * 동시 적립과의 경쟁 상태에서 중복 지급/유실을 막는다.
 */
export async function applyLevelUps(uid: string): Promise<LevelUpResult> {
  const ref = db.doc(`users/${uid}/progress/main`);
  const none: LevelUpResult = {
    leveledUp: false, newLevel: 1, levelsGained: 0, pointsAwarded: 0, seedsAwarded: 0,
  };

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return none;

    const progress = snap.data() as ProgressDoc;
    const startLevel = progress.level ?? 1;
    const startXp    = progress.xpInLevel ?? 0;
    const plants: PlantInstance[] = [...(progress.gardenState?.plants ?? [])];
    const unlocked = [...(progress.gardenState?.unlockedSpecies ?? [])];

    // 보상 규칙은 shared/lib/levelRewards 에 일원화 — 클라이언트 레벨업 창과 동일 계산.
    const prog = resolveLevelUps(startLevel, startXp);
    const levelsGained = prog.steps.length;
    const level = prog.newLevel;
    const xp    = prog.remainingXp;
    const pointsAwarded = prog.totalPoints;
    let seedsAwarded = 0;

    // 씨앗 지급은 정원 자리 상한·마일스톤 씨앗 종 같은 서버 사정이 있어 여기서 처리한다.
    for (const step of prog.steps) {
      if (!step.seed || plants.length >= MAX_GARDEN_PLANTS) continue;
      const seedSpecies = step.milestone
        ? LEVELUP_REWARD.MILESTONE_SEED_SPECIES
        : LEVELUP_REWARD.SEED_SPECIES;
      // 마일스톤 보상으로 처음 받는 종은 자동 해금 (이후 직접 심을 수 있도록)
      if (step.milestone && !unlocked.includes(LEVELUP_REWARD.MILESTONE_SEED_SPECIES)) {
        unlocked.push(LEVELUP_REWARD.MILESTONE_SEED_SPECIES);
      }
      plants.push({
        id: `levelup-${step.level}-${Date.now()}`,
        speciesId: seedSpecies,
        stage: 0,
        plantedAt: admin.firestore.Timestamp.now() as any,
      });
      seedsAwarded += 1;
    }

    if (levelsGained === 0) return { ...none, newLevel: level };

    const patch: Record<string, unknown> = {
      level,
      xpInLevel: xp,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (pointsAwarded > 0) {
      patch.spendablePoints = FieldValue.increment(pointsAwarded);
      patch.totalPoints     = FieldValue.increment(pointsAwarded);
    }
    if (seedsAwarded > 0) {
      patch.gardenState = { ...progress.gardenState, plants, unlockedSpecies: unlocked };
    }
    tx.set(ref, patch, { merge: true });

    return { leveledUp: true, newLevel: level, levelsGained, pointsAwarded, seedsAwarded };
  });

  // 보상 포인트 ledger 기록 (트랜잭션 밖)
  if (result.pointsAwarded > 0) {
    await db.collection(`users/${uid}/pointLedger`).add({
      delta: result.pointsAwarded,
      reason: 'levelup_reward',
      refId: `level_${result.newLevel}`,
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  return result;
}
