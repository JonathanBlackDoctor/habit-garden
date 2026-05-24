/**
 * awardEngine — Firestore onWrite 트리거
 * 습관 체크(habitChecks) 또는 회고(days/{date}.reflection) 변경 시:
 *  1. 포인트/XP 계산
 *  2. pointLedger 기록
 *  3. progress 문서 갱신
 *  4. 배지 조건 확인 → 신규 배지 발급
 */
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import {
  POINT_EARN,
  HABIT_DAILY_CHECK_CAP,
  BADGE_DEFS,
  type HabitDoc,
  type HabitCheckDoc,
  type ProgressDoc,
} from '../../shared/types/firestore';
import { pointsForCheck } from '../../shared/lib/habitPoints';
import { growRandomPlant } from './gardenAutogrow';

const db = admin.firestore();
const REGION = 'asia-northeast3';

// ── habitChecks onWrite ─────────────────────────────────────────────────────
export const awardEngine = functions
  .region(REGION)
  .firestore
  .document('users/{uid}/days/{date}/habitChecks/{habitId}')
  .onWrite(async (change, context) => {
    const { uid, date, habitId } = context.params;

    const before = change.before.exists ? (change.before.data() as HabitCheckDoc) : null;
    const after = change.after.exists ? (change.after.data() as HabitCheckDoc) : null;
    if (!after || after.score === null) return;

    // 점수가 변경되지 않으면 포인트 중복 지급 방지
    if (before && before.score === after.score) {
      await updateDayScore(uid, date);
      return;
    }

    // 습관 정의 로드
    const habitSnap = await db.doc(`users/${uid}/habits/${habitId}`).get();
    if (!habitSnap.exists) return;
    const habit = habitSnap.data() as HabitDoc;

    // 포인트 계산 — 이전 점수와의 차이분만 지급 (부분 점수 인정, Phase 4-4)
    const newPoints = pointsForCheck(habit.weight, habit.scoreMode, after.score);
    const oldPoints = before && before.score !== null
      ? pointsForCheck(habit.weight, habit.scoreMode, before.score)
      : 0;
    const delta = newPoints - oldPoints;
    if (delta <= 0) return;

    // Comeback Mode (Phase 4-5) — 활성화 기간이면 ×2
    const progSnap = await db.doc(`users/${uid}/progress/main`).get();
    const prog = progSnap.exists ? (progSnap.data() as ProgressDoc) : null;
    const today = date;
    const inComeback = prog?.comebackUntil && prog.comebackUntil >= today;
    const finalDelta = inComeback ? delta * 2 : delta;
    const reason = inComeback
      ? (after.achieved ? 'habit_achieved_comeback' : 'habit_partial_comeback')
      : (after.achieved ? 'habit_achieved' : 'habit_partial');

    // 하루 습관 포인트 상한 적용 (트랜잭션으로 원자적 처리)
    const dayRef = db.doc(`users/${uid}/days/${date}`);
    let cappedDelta = 0;
    await db.runTransaction(async (tx) => {
      const daySnap = await tx.get(dayRef);
      const earnedToday: number = daySnap.data()?.habitPointsToday ?? 0;
      const remaining = Math.max(0, HABIT_DAILY_CHECK_CAP - earnedToday);
      cappedDelta = Math.min(finalDelta, remaining);
      if (cappedDelta <= 0) return;
      tx.set(dayRef, {
        habitPointsToday: earnedToday + cappedDelta,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    });

    if (cappedDelta <= 0) {
      await updateDayScore(uid, date);
      return;
    }

    await creditPoints(uid, cappedDelta, reason, habitId);
    await updateDayScore(uid, date);
    await checkBadges(uid);
    if (after.achieved) await growRandomPlant(uid);  // 정원 자동 성장
    void POINT_EARN; // 미사용 경고 방지 (HABIT_BONUS_PERFECT 는 pointsForCheck 안에 통합됨)
  });

// ── 회고 작성 감지 (days 문서 onUpdate) ───────────────────────────────────
export const reflectionAward = functions
  .region(REGION)
  .firestore
  .document('users/{uid}/days/{date}')
  .onUpdate(async (change, context) => {
    const { uid, date } = context.params;

    const before = change.before.data();
    const after  = change.after.data();

    // 회고가 새로 완료된 경우만
    if (!before?.reflection && after?.reflection) {
      await creditPoints(uid, POINT_EARN.REFLECTION, 'reflection', date);
      await growRandomPlant(uid);  // 정원 자동 성장
    }
  });

// ── 공통 헬퍼 ──────────────────────────────────────────────────────────────
async function creditPoints(
  uid: string,
  delta: number,
  reason: string,
  refId?: string
) {
  const batch = db.batch();

  // pointLedger 기록
  const ledgerRef = db.collection(`users/${uid}/pointLedger`).doc();
  batch.set(ledgerRef, {
    delta,
    reason,
    refId: refId ?? null,
    createdAt: FieldValue.serverTimestamp(),
  });

  // progress 갱신
  const progressRef = db.doc(`users/${uid}/progress/main`);
  batch.set(progressRef, {
    totalPoints:     FieldValue.increment(delta),
    spendablePoints: FieldValue.increment(delta),
    xpInLevel:       FieldValue.increment(delta),
    updatedAt:        FieldValue.serverTimestamp(),
  }, { merge: true });

  await batch.commit();

  // 레벨업 확인 (별도 처리)
  await checkLevelUp(uid);
}

async function checkLevelUp(uid: string) {
  const ref  = db.doc(`users/${uid}/progress/main`);
  const snap = await ref.get();
  if (!snap.exists) return;

  const progress = snap.data() as ProgressDoc;
  const level    = progress.level ?? 1;
  const xp       = progress.xpInLevel ?? 0;
  const needed   = Math.floor(100 * Math.pow(level, 1.5));

  if (xp >= needed) {
    await ref.update({
      level:      FieldValue.increment(1),
      xpInLevel:  xp - needed,
      updatedAt:  FieldValue.serverTimestamp(),
    });
  }
}

async function updateDayScore(uid: string, date: string) {
  // 오늘의 모든 habitChecks를 읽어 가중평균 계산
  const [checksSnap, habitsSnap] = await Promise.all([
    db.collection(`users/${uid}/days/${date}/habitChecks`).get(),
    db.collection(`users/${uid}/habits`).get(),
  ]);
  const habitsMap: Record<string, HabitDoc> = {};
  habitsSnap.docs.forEach((d) => { habitsMap[d.id] = d.data() as HabitDoc; });

  let numerator = 0, denominator = 0;
  let achievedCount = 0, totalCount = 0;

  checksSnap.docs.forEach((d) => {
    const c    = d.data() as HabitCheckDoc;
    const h    = habitsMap[c.habitId];
    if (!h) return;
    totalCount++;
    if (c.achieved) achievedCount++;
    if (c.score === null) return;
    const norm = h.scoreMode === 'scaled' ? (c.score - 1) / 4 : c.score;
    numerator   += norm * h.weight;
    denominator += h.weight;
  });

  const dayScore = denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
  const successRatio = totalCount > 0 ? achievedCount / totalCount : 0;
  const isSuccessDay = successRatio >= 0.6;

  await db.doc(`users/${uid}/days/${date}`).set(
    { dayScore, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );

  if (isSuccessDay) {
    await handleSuccessDay(uid, date);
  }
}

async function handleSuccessDay(uid: string, date: string) {
  const progressRef = db.doc(`users/${uid}/progress/main`);
  const snap = await progressRef.get();
  const progress = snap.exists ? (snap.data() as ProgressDoc) : null;
  const lastStreak = progress?.globalStreak ?? 0;
  const newStreak  = lastStreak + 1;

  // globalStreak +1
  await progressRef.set({
    globalStreak:     newStreak,
    globalBestStreak: Math.max(progress?.globalBestStreak ?? 0, newStreak),
    updatedAt:         FieldValue.serverTimestamp(),
  }, { merge: true });

  // '성공한 날' 보너스
  await creditPoints(uid, POINT_EARN.DAILY_SUCCESS, 'daily_success', date);

  // 스트릭 마일스톤
  if ([7, 30, 100].includes(newStreak)) {
    const bonusMap: Record<number, number> = { 7: POINT_EARN.STREAK_7, 30: POINT_EARN.STREAK_30, 100: POINT_EARN.STREAK_100 };
    await creditPoints(uid, bonusMap[newStreak], `streak_milestone_${newStreak}`);
  }
}

async function checkBadges(uid: string) {
  const progressSnap = await db.doc(`users/${uid}/progress/main`).get();
  if (!progressSnap.exists) return;
  const p = progressSnap.data() as ProgressDoc;

  const badgeChecks: Array<{ id: string; condition: boolean }> = [
    { id: 'streak_7',   condition: (p.globalStreak ?? 0) >= 7 },
    { id: 'streak_30',  condition: (p.globalStreak ?? 0) >= 30 },
    { id: 'streak_100', condition: (p.globalStreak ?? 0) >= 100 },
  ];

  for (const { id, condition } of badgeChecks) {
    if (!condition) continue;
    const ref  = db.doc(`users/${uid}/badges/${id}`);
    const snap = await ref.get();
    if (snap.exists) continue;
    const def = BADGE_DEFS.find((b) => b.id === id);
    if (!def) continue;
    await ref.set({
      badgeId:  id,
      title:    def.title,
      tier:     def.tier,
      earnedAt: FieldValue.serverTimestamp(),
    });
  }
}
