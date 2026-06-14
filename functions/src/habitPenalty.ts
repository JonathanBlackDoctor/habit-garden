/**
 * habitPenalty — 습관 미완료 패널티 (dailyReset 에서 어제 분에 대해 호출)
 *
 * 대상: 어제의 활성·비휴면 습관 중
 *   - 손도 안 댐(체크 문서 없음, todo) → 전체 패널티
 *   - 시도했으나 미달성(score 입력, achieved=false) → 절반 패널티(MISSED_FACTOR)
 *   - 건너뛰기(score=null), 달성, 휴면, 보호된 날 → 제외
 *
 * 효과: 사용 포인트(spendable) 차감(레벨/누적 XP 는 보존) + 정원 생기 감소.
 * penaltyApplied 플래그로 하루 1회만 적용(멱등). 모든 사용자에게 항상 적용된다.
 */
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import {
  HABIT_PENALTY,
  type HabitDoc,
  type HabitCheckDoc,
} from '../../shared/types/firestore';
import { inHibernationWindow } from '../../shared/lib/hibernation';
import { SCALED_ACHIEVE_THRESHOLD } from '../../shared/lib/habitPoints';
import { bumpGardenHealth } from './gardenAutogrow';

const db = admin.firestore();

export async function applyHabitPenalty(
  uid: string,
  date: string,
  protectedDay: boolean,
): Promise<void> {
  // 보호된 날(휴가·아픔·그레이스·freeze)은 패널티 없음
  if (protectedDay) return;

  const dayRef = db.doc(`users/${uid}/days/${date}`);
  const daySnap = await dayRef.get();
  if (!daySnap.exists) return;                 // 그날 활동 자체가 없으면 건너뜀
  if (daySnap.data()?.penaltyApplied) return;  // 이미 정산함(멱등)

  // 활성·비휴면 습관 + 어제의 체크
  const [habitsSnap, checksSnap] = await Promise.all([
    db.collection(`users/${uid}/habits`).get(),
    db.collection(`users/${uid}/days/${date}/habitChecks`).get(),
  ]);
  const habits = habitsSnap.docs
    .map((d) => d.data() as HabitDoc)
    .filter((h) => h.active && !inHibernationWindow(h, date, date));
  if (habits.length === 0) return;

  const checkMap: Record<string, HabitCheckDoc> = {};
  checksSnap.docs.forEach((d) => { checkMap[d.id] = d.data() as HabitCheckDoc; });

  let points = 0;
  let healthLoss = 0;
  let count = 0;
  for (const h of habits) {
    const c = checkMap[h.id];
    let factor: number;            // 1=미기록(방치), MISSED_FACTOR=미달성(시도)
    let isTodo: boolean;
    if (!c) {
      factor = 1; isTodo = true;            // 손도 안 댐
    } else if (c.score === null) {
      continue;                              // 건너뛰기 — 제외
    } else {
      const threshold = h.scoreMode === 'scaled' ? SCALED_ACHIEVE_THRESHOLD : h.achieveThreshold;
      const achieved = c.achieved || c.score >= threshold;
      if (achieved) continue;                // 달성 — 제외
      factor = HABIT_PENALTY.MISSED_FACTOR; isTodo = false;  // 미달성
    }
    points += Math.ceil(h.weight * HABIT_PENALTY.POINT_PER_WEIGHT * factor);
    healthLoss += isTodo ? HABIT_PENALTY.HEALTH_PER_TODO : HABIT_PENALTY.HEALTH_PER_MISSED;
    count++;
  }

  points = Math.min(points, HABIT_PENALTY.DAILY_POINT_CAP);
  healthLoss = Math.min(healthLoss, HABIT_PENALTY.DAILY_HEALTH_CAP);

  // 멱등 게이트 + 표시용 값 기록 (대상이 없어도 플래그는 세워 재계산 방지)
  await dayRef.set({
    penaltyApplied: true,
    penaltyPoints: points,
    penaltyHealthLoss: healthLoss,
    penaltyCount: count,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  if (points > 0) await deductSpendable(uid, points, 'habit_penalty', date);
  if (healthLoss > 0) await bumpGardenHealth(uid, -healthLoss);
}

/**
 * 사용 포인트(spendable)만 차감한다. 0 미만으로 내려가지 않으며,
 * 실제 차감된 만큼만 ledger 에 음수로 기록한다. 레벨·누적 XP·totalPoints 는 건드리지 않는다.
 */
async function deductSpendable(uid: string, amount: number, reason: string, refId: string): Promise<void> {
  const progressRef = db.doc(`users/${uid}/progress/main`);
  let applied = 0;
  await db.runTransaction(async (tx) => {
    const p = (await tx.get(progressRef)).data();
    const cur = p?.spendablePoints ?? 0;
    applied = Math.min(cur, amount);
    if (applied <= 0) return;
    tx.set(progressRef, {
      spendablePoints: cur - applied,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
  if (applied <= 0) return;
  await db.collection(`users/${uid}/pointLedger`).doc().set({
    delta: -applied,
    reason,
    refId,
    createdAt: FieldValue.serverTimestamp(),
  });
}
